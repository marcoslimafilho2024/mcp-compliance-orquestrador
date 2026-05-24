import type { Page } from 'playwright';
import { BaseAgent } from './base.agent.js';

export type LegiswebResultado = { titulo: string; url: string };

/** Paginação (ex.: …/nav/ul/li[1]/a — o `nav` ancorado aqui). */
const XPATH_PAG_NAV = '/html/body/div[5]/div[8]/div/div/nav';

export class LegiswebAgent extends BaseAgent {
  private readonly user = process.env.LEGISWEB_USER ?? '';
  private readonly pass = process.env.LEGISWEB_PASS ?? '';

  /**
   * Remove o modal de LGPD e o backdrop via JS, sem depender de cliques.
   * data-backdrop="static" bloqueia toda interação — única saída é manipular o DOM.
   * Não verifica visibilidade antes: o modal pode ainda estar animando quando chamado.
   */
  private async dismissModalLgpd(page: Page): Promise<void> {
    try {
      // Aguarda até 3 s para o modal ou backdrop aparecerem (animação Bootstrap)
      await page
        .waitForSelector('#modalLgpd, .modal-backdrop', { state: 'attached', timeout: 3000 })
        .catch(() => undefined);

      await page.evaluate(() => {
        // API Bootstrap via jQuery (mais limpa — remove listeners internos)
        const jq = (window as unknown as { jQuery?: (s: string) => { modal(a: string): void } })
          .jQuery;
        if (jq) jq('#modalLgpd').modal('hide');

        // Remoção direta — funciona mesmo sem jQuery e elimina o backdrop residual
        const modal = document.getElementById('modalLgpd');
        if (modal) {
          modal.classList.remove('in', 'show');
          (modal as HTMLElement).style.display = 'none';
          modal.setAttribute('aria-hidden', 'true');
          modal.removeAttribute('aria-modal');
        }
        document.querySelectorAll('.modal-backdrop').forEach((el) => el.remove());
        document.body.classList.remove('modal-open');
        (document.body as HTMLElement).style.overflow = '';
        (document.body as HTMLElement).style.paddingRight = '';
      });
    } catch {
      // Nenhum modal — segue em frente
    }
  }

  async login(): Promise<void> {
    if (!this.user || !this.pass) {
      throw new Error('LEGISWEB_USER e LEGISWEB_PASS são obrigatórios no .env');
    }

    await this.retry(async () => {
      const context = await this.newContextIfNeeded();
      const page = await context.newPage();
      try {
        await page.goto('https://www.legisweb.com.br/', { waitUntil: 'domcontentloaded' });
        await this.dismissModalLgpd(page);

        // Usa fill() nativo do Playwright com force:true (ignora visibilidade do dropdown colapsado)
        // e pressiona Enter para disparar os handlers JS/AJAX do site — form.submit() os bypassa.
        // Prefere os campos do topo (primeiro input[name="login"]) que são sempre renderizados.
        const campoLogin = page.locator('input[name="login"]').first();
        const campoSenha = page.locator('input[name="senha"]').first();

        await campoLogin.fill(this.user, { force: true });
        await campoSenha.fill(this.pass, { force: true });
        await campoSenha.press('Enter');

        await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() =>
          page.waitForLoadState('domcontentloaded', { timeout: 15000 }),
        );

        // Verifica autenticação: usuário logado tem acesso a links /assinante/
        const autenticado = await page
          .locator('a[href*="/assinante/"]')
          .first()
          .isVisible()
          .catch(() => false);

        if (!autenticado) {
          const urlApos = page.url();
          throw new Error(`Login não confirmado — URL após submit: ${urlApos}`);
        }
      } finally {
        await page.close();
      }
    });
  }

  async buscar(query: string, opcoes?: { paginas?: number }): Promise<LegiswebResultado[]> {
    const paginas = Math.min(Math.max(opcoes?.paginas ?? 1, 1), 10);

    // retry(2): 1ª tentativa com sessão existente; se #termo não aparecer (sessão expirada),
    // closeSession() invalida o estado e a 2ª tentativa refaz o login automaticamente.
    return this.retry(async () => {
      await this.ensureSession();
      const page = await this.session!.newPage();
      try {
        // Carrega homepage para descobrir o href real do "Banco de Dados"
        // (varia: /assinante/bancodedados/ quando logado, /produtos/bancodedados/ quando não)
        await page.goto('https://www.legisweb.com.br/', { waitUntil: 'domcontentloaded' });
        await this.dismissModalLgpd(page);

        const bancoDadosHref = await page
          .getByRole('link', { name: /^Banco de Dados$/i })
          .first()
          .getAttribute('href')
          .catch(() => null);

        // Usuário autenticado deve acessar /assinante/bancodedados/, não /produtos/ (versão pública)
        const urlBancoRaw = bancoDadosHref
          ? new URL(bancoDadosHref, 'https://www.legisweb.com.br').href
          : 'https://www.legisweb.com.br/assinante/bancodedados/';
        const urlBanco = urlBancoRaw.replace('/produtos/bancodedados/', '/assinante/bancodedados/');

        // Navega via goto — sem clicar, sem risco de backdrop interceptar
        await page.goto(urlBanco, { waitUntil: 'domcontentloaded' });
        await this.dismissModalLgpd(page);

        const campoBusca = page.locator('#termo');

        // Timeout curto para detectar rapidamente sessão expirada (redirecionamento para login)
        const visivel = await campoBusca
          .waitFor({ state: 'visible', timeout: 10000 })
          .then(() => true)
          .catch(() => false);

        if (!visivel) {
          // Captura diagnóstico antes de fechar a sessão
          const urlAtual = page.url();
          const titulo = await page.title().catch(() => '(sem título)');
          const inputsVisiveis = await page.evaluate(() =>
            Array.from(document.querySelectorAll('input')).map((el) => ({
              id: el.id,
              name: el.name,
              type: el.type,
              placeholder: el.placeholder,
            })),
          ).catch(() => []);

          // Invalida contexto para forçar re-login na próxima tentativa
          await this.closeSession();
          throw new Error(
            `Campo #termo não encontrado — diagnóstico: url="${urlAtual}", titulo="${titulo}", inputs=${JSON.stringify(inputsVisiveis)}`,
          );
        }

        await campoBusca.fill(query);
        await campoBusca.press('Enter');

        await page.getByText(/Sua pesquisa retornou/i).waitFor({ state: 'visible', timeout: 45000 });
        await page.waitForLoadState('domcontentloaded');

        const todas: LegiswebResultado[] = [];
        const seen = new Set<string>();

        for (let p = 0; p < paginas; p++) {
          const chunk = await this.coletarLinksResultadoLegisweb(page);
          for (const r of chunk) {
            if (seen.has(r.url)) continue;
            seen.add(r.url);
            todas.push(r);
          }

          if (p + 1 >= paginas) break;
          const avancou = await this.clicarProximaPaginaLegisweb(page);
          if (!avancou) break;
        }

        return todas;
      } finally {
        // .catch() necessário: closeSession() fecha o contexto antes do finally em caso de sessão expirada
        await page.close().catch(() => undefined);
      }
    }, 2);
  }

  /**
   * Clica em "Próxima" na barra de paginação (mesma área do teu XPath …/nav/ul/…).
   * O `li[1]/a` costuma ser a página 1, não o avanço — por isso usamos o texto "Próxima".
   */
  private async clicarProximaPaginaLegisweb(page: Page): Promise<boolean> {
    const nav = page.locator(`xpath=${XPATH_PAG_NAV}`);
    if ((await nav.count()) === 0) return false;

    const proxima = nav
      .getByRole('link', { name: /^Próxima$/i })
      .or(nav.locator('a').filter({ hasText: /^Próxima$/i }))
      .first();

    if (!(await proxima.isVisible().catch(() => false))) return false;

    const cls = (await proxima.getAttribute('class')) ?? '';
    const aria = (await proxima.getAttribute('aria-disabled')) ?? '';
    if (cls.includes('disabled') || aria === 'true') return false;

    await proxima.click();
    await page.waitForLoadState('domcontentloaded');
    await page.locator('#busca_res').waitFor({ state: 'visible', timeout: 20000 });
    await new Promise((r) => setTimeout(r, 400));
    return true;
  }

  /**
   * Tabela de resultados: um XPath de exemplo é
   * //*[@id="busca_res"]/tbody/tr[1]/td/h4/a — o [1] é só a 1.ª linha.
   * Sem índice em `tr`, o seletor apanha todas as linhas da primeira página.
   */
  private async coletarLinksResultadoLegisweb(page: Page): Promise<LegiswebResultado[]> {
    await page.locator('#busca_res').waitFor({ state: 'visible', timeout: 20000 });

    const links = page.locator('#busca_res tbody tr td h4 a');
    const count = await links.count();
    const out: LegiswebResultado[] = [];
    const seen = new Set<string>();
    const max = Math.min(count, 100);

    for (let i = 0; i < max; i++) {
      const a = links.nth(i);
      const href = await a.getAttribute('href');
      const titulo = (await a.innerText()).replace(/\s+/g, ' ').trim();
      if (!href?.trim() || !titulo) continue;

      const abs = new URL(href, page.url()).href;
      if (seen.has(abs)) continue;
      seen.add(abs);
      out.push({ titulo, url: abs });
    }

    return out;
  }

  async extrairConteudo(url: string): Promise<string> {
    await this.ensureSession();
    const page = await this.session!.newPage();
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

      // Afinar com XPath do bloco principal do artigo quando tiveres.
      const candidatos = [
        'article',
        'main',
        '[role="main"]',
        '#conteudo',
        '.conteudo-artigo',
        '.texto-norma',
      ];
      for (const sel of candidatos) {
        const loc = page.locator(sel).first();
        if ((await loc.count()) > 0) {
          const texto = await loc.innerText();
          if (texto.trim().length > 80) return texto.trim();
        }
      }
      const fallback = await page.locator('body').innerText();
      return fallback.trim();
    } finally {
      await page.close();
    }
  }
}

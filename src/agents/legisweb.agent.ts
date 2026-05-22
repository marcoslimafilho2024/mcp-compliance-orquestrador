import type { Page } from 'playwright';
import { BaseAgent } from './base.agent.js';

export type LegiswebResultado = { titulo: string; url: string };

/** Paginação (ex.: …/nav/ul/li[1]/a — o `nav` ancorado aqui). */
const XPATH_PAG_NAV = '/html/body/div[5]/div[8]/div/div/nav';

export class LegiswebAgent extends BaseAgent {
  private readonly user = process.env.LEGISWEB_USER ?? '';
  private readonly pass = process.env.LEGISWEB_PASS ?? '';

  /** Fecha o modal de LGPD/cookies caso esteja visível — bloqueia todos os cliques se ignorado. */
  private async dismissModalLgpd(page: Page): Promise<void> {
    try {
      const modal = page.locator('#modalLgpd');
      const visivel = await modal.isVisible({ timeout: 4000 }).catch(() => false);
      if (!visivel) return;

      // Bootstrap com data-backdrop="static" ignora cliques no backdrop e ESC.
      // Forçar fechamento via JS: remove backdrop, oculta modal e libera o body.
      await page.evaluate(() => {
        const modal = document.getElementById('modalLgpd');
        if (!modal) return;
        // Tenta API Bootstrap 3 / 4 via jQuery
        const jq = (window as unknown as Record<string, unknown>)['jQuery'] as
          | ((sel: string) => { modal: (action: string) => void })
          | undefined;
        if (jq) {
          jq('#modalLgpd').modal('hide');
        }
        // Remoção direta como fallback (garante mesmo sem jQuery disponível)
        modal.classList.remove('in', 'show');
        (modal as HTMLElement).style.display = 'none';
        modal.setAttribute('aria-hidden', 'true');
        document.querySelectorAll('.modal-backdrop').forEach((el) => el.remove());
        document.body.classList.remove('modal-open');
        (document.body as HTMLElement).style.overflow = '';
        (document.body as HTMLElement).style.paddingRight = '';
      });

      await modal.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => undefined);
    } catch {
      // Modal não encontrado ou já fechado — segue em frente
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
        // Página de login dedicada — formulário principal sempre visível
        await page.goto('https://www.legisweb.com.br/assinante/login/', {
          waitUntil: 'domcontentloaded',
        });

        // Fecha modal de LGPD antes de qualquer interação
        await this.dismissModalLgpd(page);

        // Formulário da página de login (não o dropdown do menu do topo)
        const userInput = page.locator('form input[name="login"], form input[type="text"]').first();
        const passInput = page.locator('form input[name="senha"], form input[type="password"]').first();

        await userInput.waitFor({ state: 'visible', timeout: 15000 });
        await passInput.waitFor({ state: 'visible', timeout: 15000 });

        await userInput.fill(this.user);
        await passInput.fill(this.pass);
        await passInput.press('Enter');

        await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {
          return page.waitForLoadState('domcontentloaded', { timeout: 15000 });
        });
      } finally {
        await page.close();
      }
    });
  }

  async buscar(query: string, opcoes?: { paginas?: number }): Promise<LegiswebResultado[]> {
    const paginas = Math.min(Math.max(opcoes?.paginas ?? 1, 1), 10);

    await this.ensureSession();
    const page = await this.session!.newPage();
    try {
      await page.goto('https://www.legisweb.com.br/', { waitUntil: 'domcontentloaded' });

      // Fecha modal de LGPD antes de tentar clicar em qualquer link
      await this.dismissModalLgpd(page);

      const bancoDados = page.getByRole('link', { name: /^Banco de Dados$/i }).first();
      if (await bancoDados.isVisible().catch(() => false)) {
        await bancoDados.click();
        await page.waitForLoadState('domcontentloaded');
        await this.dismissModalLgpd(page);
      }

      const campoBusca = page.locator('#termo');
      await campoBusca.waitFor({ state: 'visible', timeout: 20000 });
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
      await page.close();
    }
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

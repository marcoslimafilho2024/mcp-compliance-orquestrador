import type { Page } from 'playwright';
import { BaseAgent } from './base.agent.js';

export type SijutResultado = { titulo: string; url: string };

const URL_CONSULTA = 'https://normas.receita.fazenda.gov.br/sijut2consulta/consulta.action';

export class SijutAgent extends BaseAgent {
  /** Portal aberto — apenas inicializa contexto de browser. */
  async login(): Promise<void> {
    await this.newContextIfNeeded();
  }

  async buscar(
    query: string,
    opcoes?: { paginas?: number; apenasVigentes?: boolean },
  ): Promise<SijutResultado[]> {
    const paginas = Math.min(Math.max(opcoes?.paginas ?? 1, 1), 10);
    const apenasVigentes = opcoes?.apenasVigentes ?? true;

    await this.ensureSession();
    const page = await this.session!.newPage();
    try {
      await page.goto(URL_CONSULTA, { waitUntil: 'domcontentloaded', timeout: 60000 });

      // Marca "apenas vigentes" se solicitado (marcado por padrão no portal — garante estado)
      const chk = page.locator('xpath=//*[@id="chkAtosVigentes"]');
      if ((await chk.count()) > 0) {
        const marcado = await chk.isChecked();
        if (apenasVigentes && !marcado) await chk.check();
        if (!apenasVigentes && marcado) await chk.uncheck();
      }

      const campo = page.locator('xpath=//*[@id="termoBusca"]');
      await campo.waitFor({ state: 'visible', timeout: 20000 });
      await campo.fill(query);
      await campo.press('Enter');

      // Aguarda tabela de resultados aparecer
      await page
        .locator('xpath=//*[@id="tabelaAtos"]')
        .waitFor({ state: 'visible', timeout: 45000 });
      await page.waitForLoadState('domcontentloaded');

      const todas: SijutResultado[] = [];
      const seen = new Set<string>();

      for (let p = 0; p < paginas; p++) {
        const chunk = await this.coletarLinks(page);
        for (const r of chunk) {
          if (seen.has(r.url)) continue;
          seen.add(r.url);
          todas.push(r);
        }

        if (p + 1 >= paginas) break;
        const avancou = await this.proximaPagina(page);
        if (!avancou) break;
      }

      return todas;
    } finally {
      await page.close();
    }
  }

  private async coletarLinks(page: Page): Promise<SijutResultado[]> {
    // Cada resultado: //*[@id="tabelaAtos"]/tbody[1]/tr[N]/td[2]/a
    const links = page.locator('xpath=//*[@id="tabelaAtos"]/tbody[1]/tr/td[2]/a');
    const count = await links.count();
    const out: SijutResultado[] = [];

    for (let i = 0; i < count; i++) {
      const a = links.nth(i);
      const href = await a.getAttribute('href').catch(() => null);
      const titulo = (await a.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
      if (!href?.trim() || !titulo) continue;

      const abs = href.startsWith('http')
        ? href
        : new URL(href, 'https://normas.receita.fazenda.gov.br').href;

      out.push({ titulo, url: abs });
    }

    return out;
  }

  /**
   * Avança para a próxima página via container de paginação #p.
   * Tenta link "Próxima" ou ">"; se não encontrar, retorna false.
   */
  private async proximaPagina(page: Page): Promise<boolean> {
    const pag = page.locator('xpath=//*[@id="p"]');
    if ((await pag.count()) === 0) return false;

    // Tenta texto "Próxima", "Próximo", ">" ou símbolo »
    const proxima = pag
      .locator('a')
      .filter({ hasText: /Próxim[ao]|»|>$/i })
      .last();

    if (!(await proxima.isVisible().catch(() => false))) return false;

    const cls = (await proxima.getAttribute('class')) ?? '';
    if (cls.includes('disabled')) return false;

    await proxima.click();
    await page.waitForLoadState('domcontentloaded');
    await page
      .locator('xpath=//*[@id="tabelaAtos"]')
      .waitFor({ state: 'visible', timeout: 30000 });
    await new Promise((r) => setTimeout(r, 400));
    return true;
  }

  async extrairConteudo(url: string): Promise<string> {
    await this.ensureSession();
    const page = await this.session!.newPage();
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

      // Candidatos ao bloco principal da norma no SIJUT
      const candidatos = [
        '#divTextoAto',
        '.textoAto',
        '#conteudoTexto',
        'article',
        'main',
        '[role="main"]',
      ];
      for (const sel of candidatos) {
        const loc = page.locator(sel).first();
        if ((await loc.count()) > 0) {
          const texto = await loc.innerText();
          if (texto.trim().length > 80) return texto.trim();
        }
      }

      return (await page.locator('body').innerText()).trim();
    } finally {
      await page.close();
    }
  }
}

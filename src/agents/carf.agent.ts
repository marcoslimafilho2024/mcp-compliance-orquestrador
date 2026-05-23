import type { Page } from 'playwright';
import { BaseAgent } from './base.agent.js';

export type CarfResultado = {
  acordao: string;
  ementa: string;
  url: string;
};

const URL_CARF =
  'https://carf.fazenda.gov.br/sincon/public/pages/ConsultarJurisprudencia/consultarJurisprudenciaCarf.jsf';

export class CarfAgent extends BaseAgent {
  /** Portal aberto — apenas inicializa contexto de browser. */
  async login(): Promise<void> {
    await this.newContextIfNeeded();
  }

  async buscar(
    query: string,
    opcoes?: { paginas?: number },
  ): Promise<CarfResultado[]> {
    const paginas = Math.min(Math.max(opcoes?.paginas ?? 1, 1), 10);

    await this.ensureSession();
    const page = await this.session!.newPage();
    try {
      await page.goto(URL_CARF, { waitUntil: 'domcontentloaded', timeout: 60000 });

      // Seleciona radio "Acórdão" (busca por acórdão, não processo)
      const radioAcordao = page
        .locator('input[type="radio"]')
        .filter({ hasText: /acórdão/i })
        .or(page.locator('label').filter({ hasText: /^Acórdão$/i }).locator('..').locator('input[type="radio"]'))
        .first();

      if ((await radioAcordao.count()) > 0) {
        await radioAcordao.check().catch(() => undefined);
      }

      // Campo de texto de busca — JSF tipicamente usa input próximo ao label "Pesquisar"
      // Tenta campo de ementa/texto livre
      await this.preencherCampoBusca(page, query);

      // Clica no botão de pesquisa
      await this.clicarPesquisar(page);

      // Aguarda tabela de resultados
      await this.aguardarResultados(page);

      const todas: CarfResultado[] = [];
      const seen = new Set<string>();

      for (let p = 0; p < paginas; p++) {
        const chunk = await this.coletarResultados(page);
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

  /**
   * Preenche o campo de busca por texto livre.
   * JSF gera IDs dinâmicos (j_idt123:campo) — usamos heurísticas.
   */
  private async preencherCampoBusca(page: Page, query: string): Promise<void> {
    // Tenta selecionar "Ementa + Decisão" no dropdown de campo de busca, se existir
    const selectCampo = page.locator('select').first();
    if ((await selectCampo.count()) > 0) {
      const opts = await selectCampo.locator('option').allTextContents();
      const ementaDecisao = opts.find((o) => /ementa.*decisão|decisão.*ementa/i.test(o));
      const ementa = opts.find((o) => /^ementa$/i.test(o.trim()));
      const alvo = ementaDecisao ?? ementa;
      if (alvo) await selectCampo.selectOption({ label: alvo }).catch(() => undefined);
    }

    // Campo de texto: procura input do tipo text visível que não seja data
    const inputs = page.locator('input[type="text"]:visible');
    const count = await inputs.count();

    for (let i = 0; i < count; i++) {
      const inp = inputs.nth(i);
      const placeholder = (await inp.getAttribute('placeholder')) ?? '';
      const id = (await inp.getAttribute('id')) ?? '';
      // Pula campos de data (geralmente têm "data", "mes", "ano" no id/placeholder)
      if (/data|mes|mês|ano|year|month/i.test(id + placeholder)) continue;
      await inp.fill(query);
      return;
    }

    // Fallback: qualquer textarea visível
    const ta = page.locator('textarea:visible').first();
    if ((await ta.count()) > 0) {
      await ta.fill(query);
    }
  }

  /** Clica no botão de pesquisa. */
  private async clicarPesquisar(page: Page): Promise<void> {
    const botao = page
      .locator('input[type="submit"], button[type="submit"], button')
      .filter({ hasText: /pesquisar|buscar|consultar/i })
      .first()
      .or(page.getByRole('button', { name: /pesquisar|buscar|consultar/i }).first());

    if ((await botao.count()) > 0) {
      await botao.click();
    } else {
      // Fallback: submete via Enter no campo de busca
      await page.keyboard.press('Enter');
    }
  }

  /** Aguarda a tabela de resultados ficar visível. */
  private async aguardarResultados(page: Page): Promise<void> {
    // CARF geralmente retorna tabela com classe "rich-table" ou "dataTable" (JSF RichFaces)
    const candidatos = [
      'table.rich-table',
      'table.dataTable',
      'table.resultTable',
      '[id*="tabelaResultado"]',
      '[id*="dataTable"]',
      '[id*="resultado"]',
      'table tbody tr td a',
    ];

    for (const sel of candidatos) {
      try {
        await page.locator(sel).first().waitFor({ state: 'visible', timeout: 5000 });
        return;
      } catch {
        // continua tentando
      }
    }

    // Aguarda qualquer link de acórdão aparecer
    await page
      .locator('a')
      .filter({ hasText: /acórdão|^\d{4}-\d{2}\.|\d{8}/i })
      .first()
      .waitFor({ state: 'visible', timeout: 30000 })
      .catch(() => undefined);

    await page.waitForLoadState('domcontentloaded');
  }

  /** Coleta os resultados da página atual. */
  private async coletarResultados(page: Page): Promise<CarfResultado[]> {
    // Tenta identificar linhas de resultado por links que parecem acórdãos
    const linhas = page.locator('table tbody tr').filter({
      has: page.locator('a[href]'),
    });

    const count = await linhas.count();
    const out: CarfResultado[] = [];

    if (count > 0) {
      for (let i = 0; i < count; i++) {
        const tr = linhas.nth(i);
        const link = tr.locator('a[href]').first();
        const href = await link.getAttribute('href').catch(() => null);
        const textoLinha = (await tr.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();

        if (!textoLinha || textoLinha.length < 5) continue;

        // Separa número do acórdão (primeira célula) da ementa (demais)
        const celulas = tr.locator('td');
        const numCelulas = await celulas.count();
        const acordao =
          numCelulas > 0
            ? (await celulas.nth(0).innerText().catch(() => '')).replace(/\s+/g, ' ').trim()
            : textoLinha.slice(0, 60);
        const ementa =
          numCelulas > 1
            ? (await celulas.nth(1).innerText().catch(() => '')).replace(/\s+/g, ' ').trim()
            : '';

        const url = href
          ? href.startsWith('http')
            ? href
            : new URL(href, 'https://carf.fazenda.gov.br').href
          : page.url();

        out.push({ acordao, ementa, url });
      }
    }

    return out;
  }

  /** Avança para a próxima página de resultados. */
  private async proximaPagina(page: Page): Promise<boolean> {
    // RichFaces usa links de paginação com texto numérico ou "Próxima"
    const proxima = page
      .locator('a')
      .filter({ hasText: /^Próxim[ao]$|»|>\s*$/ })
      .last();

    if (!(await proxima.isVisible().catch(() => false))) return false;

    const cls = (await proxima.getAttribute('class')) ?? '';
    if (cls.includes('disabled') || cls.includes('rich-datascr-button-dsbld')) return false;

    await proxima.click();
    await page.waitForLoadState('domcontentloaded');
    await this.aguardarResultados(page);
    await new Promise((r) => setTimeout(r, 500));
    return true;
  }

  /** Extrai o texto completo de um acórdão a partir da URL. */
  async extrairConteudo(url: string): Promise<string> {
    await this.ensureSession();
    const page = await this.session!.newPage();
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

      const candidatos = [
        '[id*="textoAcordao"]',
        '[id*="conteudoAcordao"]',
        '[class*="textoAcordao"]',
        '[class*="acordao"]',
        '.rich-panel-body',
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

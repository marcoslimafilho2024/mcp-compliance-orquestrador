import type { Page } from 'playwright';
import { BaseAgent } from './base.agent.js';

export type CarfAcordaosResultado = {
  titulo: string;
  url: string;
};

const URL_PORTAL = 'https://acordaos.economia.gov.br/solr/acordaos2/browse/';

// XPath do campo de busca
const XP_BUSCA = '//*[@id="q"]';
// XPath do link de próxima página (paginador)
const XP_PROXIMA = '//*[@id="content"]/div[3]/a';
// XPath base dos resultados: div[5]/div[N]/div[1]/b/a
const XP_RESULTADO_BASE = '//*[@id="content"]/div[5]';

export class CarfAcordaosAgent extends BaseAgent {
  /** Portal público — apenas inicializa contexto de browser. */
  async login(): Promise<void> {
    await this.newContextIfNeeded();
  }

  async buscar(
    query: string,
    opcoes?: { paginas?: number },
  ): Promise<CarfAcordaosResultado[]> {
    const paginas = Math.min(Math.max(opcoes?.paginas ?? 1, 1), 10);

    await this.ensureSession();
    const page = await this.session!.newPage();
    try {
      await page.goto(URL_PORTAL, { waitUntil: 'domcontentloaded', timeout: 60000 });

      // Preenche campo de busca
      const campo = page.locator(`xpath=${XP_BUSCA}`);
      await campo.waitFor({ state: 'visible', timeout: 20000 });
      await campo.fill(query);

      // Submete e aguarda carregamento
      await Promise.all([
        page.waitForLoadState('domcontentloaded', { timeout: 60000 }),
        campo.press('Enter'),
      ]);
      await new Promise((r) => setTimeout(r, 800));

      const todas: CarfAcordaosResultado[] = [];
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
   * Coleta resultados da página atual.
   * Padrão DOM: #content > div[5] > div[N] > div[1] > b > a
   * onde N começa em 1 e incrementa por resultado.
   */
  private async coletarResultados(page: Page): Promise<CarfAcordaosResultado[]> {
    const container = page.locator(`xpath=${XP_RESULTADO_BASE}`);
    if ((await container.count()) === 0) return [];

    // Coleta todos os links filhos com o padrão div > div[1] > b > a
    const links = container.locator('> div > div:first-child > b > a');
    const count = await links.count();
    const out: CarfAcordaosResultado[] = [];

    for (let i = 0; i < count; i++) {
      const link = links.nth(i);
      const titulo = (await link.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
      const href = await link.getAttribute('href').catch(() => null);
      if (!titulo || !href) continue;

      const url = href.startsWith('http') ? href : new URL(href, URL_PORTAL).href;
      out.push({ titulo, url });
    }

    return out;
  }

  /** Avança para a próxima página. */
  private async proximaPagina(page: Page): Promise<boolean> {
    // O paginador é um <a> em //*[@id="content"]/div[3]/a
    // Pode haver vários links (páginas numeradas + "Próxima") — pega o último
    const links = page.locator(`xpath=${XP_PROXIMA}`);
    const count = await links.count();
    if (count === 0) return false;

    // Procura link com texto indicando próxima página
    for (let i = count - 1; i >= 0; i--) {
      const link = links.nth(i);
      const texto = (await link.innerText().catch(() => '')).trim();
      if (/próxim[ao]|next|»|>/i.test(texto) || i === count - 1) {
        const href = await link.getAttribute('href').catch(() => null);
        if (!href) return false;

        await Promise.all([
          page.waitForLoadState('domcontentloaded', { timeout: 60000 }),
          link.click(),
        ]);
        await new Promise((r) => setTimeout(r, 600));
        return true;
      }
    }

    return false;
  }

  /** Extrai o texto completo do acórdão a partir da URL do resultado. */
  async extrairConteudo(url: string): Promise<string> {
    await this.ensureSession();
    const page = await this.session!.newPage();
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

      // Tenta seletores candidatos de conteúdo
      const candidatos = [
        '[id*="content"]',
        'article',
        'main',
        '[role="main"]',
        '#content',
        '.content',
      ];

      for (const sel of candidatos) {
        const loc = page.locator(sel).first();
        if ((await loc.count()) > 0) {
          const texto = await loc.innerText().catch(() => '');
          if (texto.trim().length > 80) return texto.trim();
        }
      }

      return (await page.locator('body').innerText()).trim();
    } finally {
      await page.close();
    }
  }
}

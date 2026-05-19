import { BaseAgent } from './base.agent.js';

export type TaxPraticoResultado = { titulo: string; url: string };

export class TaxPraticoAgent extends BaseAgent {
  private readonly user = process.env.TAXPRATICO_USER ?? '';
  private readonly pass = process.env.TAXPRATICO_PASS ?? '';

  async login(): Promise<void> {
    if (!this.user || !this.pass) {
      throw new Error('TAXPRATICO_USER e TAXPRATICO_PASS são obrigatórios no .env');
    }

    await this.retry(async () => {
      const context = await this.newContextIfNeeded();
      const page = await context.newPage();
      try {
        await page.goto('https://taxpratico.com.br/assinante/login', {
          waitUntil: 'domcontentloaded',
        });

        // PLACEHOLDER_SELECTOR — inspecionar HTML real do formulário de login
        await page.locator('PLACEHOLDER_SELECTOR').fill(this.user);
        await page.locator('PLACEHOLDER_SELECTOR').fill(this.pass);
        await page.locator('PLACEHOLDER_SELECTOR').click();
      } finally {
        await page.close();
      }
    });
  }

  async buscar(query: string): Promise<TaxPraticoResultado[]> {
    await this.ensureSession();
    const page = await this.session!.newPage();
    try {
      // PLACEHOLDER_SELECTOR — fluxo de busca interna
      await page.goto('https://taxpratico.com.br/', { waitUntil: 'domcontentloaded' });
      await page.locator('PLACEHOLDER_SELECTOR').fill(query);
      await page.locator('PLACEHOLDER_SELECTOR').click();

      // PLACEHOLDER_SELECTOR — lista de resultados
      const links = page.locator('PLACEHOLDER_SELECTOR');
      const count = await links.count();
      const out: TaxPraticoResultado[] = [];
      for (let i = 0; i < count; i++) {
        const item = links.nth(i);
        const titulo = (await item.textContent())?.trim() ?? '';
        const href = await item.getAttribute('href');
        if (href) {
          out.push({
            titulo,
            url: new URL(href, page.url()).href,
          });
        }
      }
      return out;
    } finally {
      await page.close();
    }
  }

  async extrairConteudo(url: string): Promise<string> {
    await this.ensureSession();
    const page = await this.session!.newPage();
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      // PLACEHOLDER_SELECTOR — corpo do procedimento / conteúdo
      const texto = await page.locator('PLACEHOLDER_SELECTOR').innerText();
      return texto.trim();
    } finally {
      await page.close();
    }
  }
}

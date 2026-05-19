import { BaseAgent } from './base.agent.js';

export type LegiswebResultado = { titulo: string; url: string };

export class LegiswebAgent extends BaseAgent {
  private readonly user = process.env.LEGISWEB_USER ?? '';
  private readonly pass = process.env.LEGISWEB_PASS ?? '';

  async login(): Promise<void> {
    if (!this.user || !this.pass) {
      throw new Error('LEGISWEB_USER e LEGISWEB_PASS são obrigatórios no .env');
    }

    await this.retry(async () => {
      const context = await this.newContextIfNeeded();
      const page = await context.newPage();
      try {
        await page.goto('https://www.legisweb.com.br/assinante/login/', {
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

  async buscar(query: string): Promise<LegiswebResultado[]> {
    await this.ensureSession();
    const page = await this.session!.newPage();
    try {
      // PLACEHOLDER_SELECTOR — campo de busca / URL da busca
      await page.goto('https://www.legisweb.com.br/', { waitUntil: 'domcontentloaded' });
      await page.locator('PLACEHOLDER_SELECTOR').fill(query);
      await page.locator('PLACEHOLDER_SELECTOR').click();

      // PLACEHOLDER_SELECTOR — lista de resultados
      const links = page.locator('PLACEHOLDER_SELECTOR');
      const count = await links.count();
      const out: LegiswebResultado[] = [];
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
      // PLACEHOLDER_SELECTOR — corpo do artigo / norma
      const texto = await page.locator('PLACEHOLDER_SELECTOR').innerText();
      return texto.trim();
    } finally {
      await page.close();
    }
  }
}

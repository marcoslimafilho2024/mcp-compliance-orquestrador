import type { Page } from 'playwright';
import { BaseAgent } from './base.agent.js';

export type TaxPraticoResultado = { titulo: string; url: string };

const XP_LOGIN_USER =
  '/html/body/main/section/div/div/div[2]/form/div[2]/div/div[2]/input';
const XP_LOGIN_PASS =
  '/html/body/main/section/div/div/div[2]/form/div[2]/div/div[3]/input';
const XP_LOGIN_ENTRAR =
  '/html/body/main/section/div/div/div[2]/form/div[2]/div/div[5]/div/div/button';

/** Campo de busca no header após login. */
const XP_BUSCA_HEADER =
  '/html/body/header/nav/div[2]/div/div[2]/div[2]/div/form/div/div[1]/input';

/** Dropdown de UF (ex.: CEARÁ = botão [5]). */
const XP_UF_DROPDOWN = '/html/body/header/nav/div[3]/div/div/button[5]';
/** Primeira opção do dropdown (CEARÁ no teu mapeamento). */
const XP_UF_CEARA_LINK =
  '/html/body/header/nav/div[3]/div/div/button[5]/ul/li[1]/a';

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

        const userInput = page.locator(`xpath=${XP_LOGIN_USER}`);
        const passInput = page.locator(`xpath=${XP_LOGIN_PASS}`);
        const entrar = page.locator(`xpath=${XP_LOGIN_ENTRAR}`);

        await userInput.waitFor({ state: 'visible', timeout: 25000 });
        await passInput.waitFor({ state: 'visible', timeout: 25000 });
        await entrar.waitFor({ state: 'visible', timeout: 25000 });

        await userInput.fill(this.user);
        await passInput.fill(this.pass);
        await entrar.click();

        await page.waitForLoadState('networkidle', { timeout: 35000 }).catch(() => {
          return page.waitForLoadState('domcontentloaded', { timeout: 15000 });
        });
      } finally {
        await page.close();
      }
    });
  }

  async buscar(
    query: string,
    opcoes?: { filtroCeara?: boolean },
  ): Promise<TaxPraticoResultado[]> {
    await this.ensureSession();
    const page = await this.session!.newPage();
    try {
      await page.goto('https://taxpratico.com.br/', {
        waitUntil: 'domcontentloaded',
      });

      if (opcoes?.filtroCeara) {
        await this.aplicarFiltroCeara(page);
      }

      const campo = page
        .locator('#busca-artigos')
        .or(page.locator(`xpath=${XP_BUSCA_HEADER}`));
      await campo.waitFor({ state: 'visible', timeout: 25000 });
      await campo.fill(query);
      await campo.press('Enter');

      await page.locator('#lista-artigos').waitFor({ state: 'visible', timeout: 35000 });
      await page.waitForLoadState('domcontentloaded');
      await new Promise((r) => setTimeout(r, 500));

      return await this.coletarListaArtigos(page);
    } finally {
      await page.close();
    }
  }

  private async aplicarFiltroCeara(page: Page): Promise<void> {
    const drop = page.locator(`xpath=${XP_UF_DROPDOWN}`);
    await drop.waitFor({ state: 'visible', timeout: 20000 });
    await drop.click();

    const ce = page.locator(`xpath=${XP_UF_CEARA_LINK}`);
    await ce.waitFor({ state: 'visible', timeout: 15000 });
    await ce.click();

    await page.waitForLoadState('domcontentloaded');
    await new Promise((r) => setTimeout(r, 400));
  }

  /** Links em `#lista-artigos` (cada `a` com título em `p` quando existir). */
  private async coletarListaArtigos(page: Page): Promise<TaxPraticoResultado[]> {
    const anchors = page.locator('#lista-artigos > a[href]');
    const count = Math.min(await anchors.count(), 60);
    const out: TaxPraticoResultado[] = [];
    const seen = new Set<string>();

    for (let i = 0; i < count; i++) {
      const a = anchors.nth(i);
      const href = await a.getAttribute('href');
      if (!href?.trim()) continue;

      let titulo = '';
      const p = a.locator('p').first();
      if ((await p.count()) > 0) {
        titulo = (await p.innerText()).replace(/\s+/g, ' ').trim();
      } else {
        titulo = (await a.innerText()).replace(/\s+/g, ' ').trim();
      }
      if (!titulo) continue;

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

      const candidatos = [
        'article',
        'main',
        '[role="main"]',
        '#conteudo-artigo',
        '.conteudo-artigo',
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

import type { Page } from 'playwright';
import { BaseAgent } from './base.agent.js';

export type KeepNota = {
  id: string;
  titulo: string;
  conteudo: string;
  itens?: { texto: string; marcado: boolean }[];
  cor: string;
  fixada: boolean;
  arquivada: boolean;
};

export class KeepAgent extends BaseAgent {
  private readonly BASE_URL = 'https://keep.google.com';

  protected async login(): Promise<void> {
    const cookiesJson = process.env.GOOGLE_KEEP_COOKIES_JSON;
    if (!cookiesJson) {
      throw new Error(
        'GOOGLE_KEEP_COOKIES_JSON não configurado no Railway. ' +
        'Exporte seus cookies do Google Keep e salve nesta variável. ' +
        'Use a extensão "EditThisCookie" ou "Cookie-Editor" no Chrome para exportar.',
      );
    }

    const context = await this.newContextIfNeeded();

    let cookies: unknown[];
    try {
      cookies = JSON.parse(cookiesJson);
    } catch {
      throw new Error('GOOGLE_KEEP_COOKIES_JSON contém JSON inválido.');
    }

    // Formata cookies para o formato do Playwright
    const playwrightCookies = (cookies as Array<Record<string, unknown>>).map((c) => ({
      name: String(c.name ?? c.Name ?? ''),
      value: String(c.value ?? c.Value ?? ''),
      domain: String(c.domain ?? c.Domain ?? '.google.com'),
      path: String(c.path ?? c.Path ?? '/'),
      expires: typeof c.expirationDate === 'number' ? c.expirationDate :
               typeof c.expires === 'number' ? c.expires : -1,
      httpOnly: Boolean(c.httpOnly ?? c.HttpOnly ?? false),
      secure: Boolean(c.secure ?? c.Secure ?? true),
      sameSite: 'Lax' as const,
    })).filter((c) => c.name && c.value);

    await context.addCookies(playwrightCookies);
  }

  async listarNotas(filtro?: string): Promise<KeepNota[]> {
    return this.retry(async () => {
      await this.ensureSession();
      const page = await this.session!.newPage();
      try {
        const url = filtro
          ? `${this.BASE_URL}/#search/${encodeURIComponent(filtro)}`
          : this.BASE_URL;

        await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
        await this.verificarAutenticacao(page);
        await page.waitForTimeout(2000);

        return await this.extrairNotas(page);
      } finally {
        await page.close().catch(() => undefined);
      }
    }, 2);
  }

  async criarNota(titulo: string, conteudo: string, itens?: string[]): Promise<KeepNota> {
    return this.retry(async () => {
      await this.ensureSession();
      const page = await this.session!.newPage();
      try {
        await page.goto(this.BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
        await this.verificarAutenticacao(page);
        await page.waitForTimeout(1500);

        if (itens && itens.length > 0) {
          return await this.criarChecklist(page, titulo, itens);
        }
        return await this.criarNotaTexto(page, titulo, conteudo);
      } finally {
        await page.close().catch(() => undefined);
      }
    }, 2);
  }

  private async criarNotaTexto(page: Page, titulo: string, conteudo: string): Promise<KeepNota> {
    // Clica na área "Criar uma nota..."
    const areaInput = page.locator('[aria-label="Criar uma nota..."], [placeholder="Criar uma nota..."]').first();
    await areaInput.click({ timeout: 10000 });
    await page.waitForTimeout(500);

    // Preenche título se houver campo
    const campoTitulo = page.locator('[aria-label="Título"], [placeholder="Título"]').first();
    const tituloVisivel = await campoTitulo.isVisible().catch(() => false);
    if (tituloVisivel && titulo) {
      await campoTitulo.fill(titulo);
    }

    // Preenche conteúdo
    const campoConteudo = page.locator('[aria-label="Criar uma nota..."], [aria-multiline="true"]').last();
    await campoConteudo.click();
    await campoConteudo.fill(conteudo);

    // Fecha a nota (salva automaticamente)
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1500);

    return {
      id: `nota-${Date.now()}`,
      titulo: titulo || '(sem título)',
      conteudo,
      cor: 'default',
      fixada: false,
      arquivada: false,
    };
  }

  private async criarChecklist(page: Page, titulo: string, itens: string[]): Promise<KeepNota> {
    // Clica no ícone de checklist (novo item de lista)
    const botaoLista = page.locator('[data-tooltip="Nova lista"], [aria-label="Nova lista"]').first();
    const botaoListaVisivel = await botaoLista.isVisible().catch(() => false);

    if (botaoListaVisivel) {
      await botaoLista.click();
    } else {
      // Fallback: clica na área de criar nota e abre como lista
      await page.locator('[aria-label="Criar uma nota..."]').first().click();
      await page.waitForTimeout(500);
    }

    await page.waitForTimeout(500);

    // Preenche título
    const campoTitulo = page.locator('[aria-label="Título"], [placeholder="Título"]').first();
    const tituloVisivel = await campoTitulo.isVisible().catch(() => false);
    if (tituloVisivel && titulo) {
      await campoTitulo.fill(titulo);
    }

    // Adiciona cada item
    for (const item of itens) {
      const campoItem = page.locator('[aria-label="Item de lista"], [placeholder="Item de lista"]').last();
      await campoItem.fill(item);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(200);
    }

    await page.keyboard.press('Escape');
    await page.waitForTimeout(1500);

    return {
      id: `nota-${Date.now()}`,
      titulo: titulo || '(sem título)',
      conteudo: '',
      itens: itens.map((t) => ({ texto: t, marcado: false })),
      cor: 'default',
      fixada: false,
      arquivada: false,
    };
  }

  private async extrairNotas(page: Page): Promise<KeepNota[]> {
    return page.evaluate(() => {
      const notas: Array<{
        id: string;
        titulo: string;
        conteudo: string;
        itens?: { texto: string; marcado: boolean }[];
        cor: string;
        fixada: boolean;
        arquivada: boolean;
      }> = [];

      // Seleciona todos os cards de nota
      const cards = document.querySelectorAll('[data-id], .IZ65Hb-n0tgWb, [jscontroller="AvxJpb"]');

      cards.forEach((card, i) => {
        const id = card.getAttribute('data-id') ?? `nota-${i}`;
        const titulo = (card.querySelector('[aria-label*="Título"], .Q7Lbzc, [data-field="title"]')?.textContent ?? '').trim();
        const conteudo = (card.querySelector('.q1bV7c, .jVjTId, [data-field="text"], [aria-label*="Conteúdo"]')?.textContent ?? '').trim();

        // Itens de checklist
        const itemEls = card.querySelectorAll('.bsc6Pa, [role="listitem"], .ckI2N');
        const itens: { texto: string; marcado: boolean }[] = [];
        itemEls.forEach((el) => {
          const texto = (el.querySelector('.A4cDfc, .title')?.textContent ?? el.textContent ?? '').trim();
          const marcado = el.querySelector('[aria-checked="true"]') !== null;
          if (texto) itens.push({ texto, marcado });
        });

        if (titulo || conteudo || itens.length > 0) {
          notas.push({
            id,
            titulo: titulo || '(sem título)',
            conteudo,
            itens: itens.length > 0 ? itens : undefined,
            cor: 'default',
            fixada: false,
            arquivada: false,
          });
        }
      });

      return notas.slice(0, 50);
    });
  }

  private async verificarAutenticacao(page: Page): Promise<void> {
    const url = page.url();
    if (url.includes('accounts.google.com') || url.includes('/ServiceLogin')) {
      await this.closeSession();
      throw new Error(
        'Sessão expirada. Os cookies do Google Keep precisam ser atualizados. ' +
        'Exporte novamente os cookies do keep.google.com e atualize GOOGLE_KEEP_COOKIES_JSON no Railway.',
      );
    }
  }
}

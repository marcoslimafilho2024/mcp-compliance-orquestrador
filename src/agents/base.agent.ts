import { chromium, type Browser, type BrowserContext } from 'playwright';

const serverChromiumArgs = [
  '--no-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--single-process',
] as const;

export abstract class BaseAgent {
  protected session: BrowserContext | null = null;
  protected browser: Browser | null = null;

  protected abstract login(): Promise<void>;

  async ensureSession(): Promise<void> {
    if (!this.session) {
      await this.login();
    }
  }

  async retry<T>(fn: () => Promise<T>, tentativas = 3): Promise<T> {
    let ultimo: unknown;
    for (let i = 0; i < tentativas; i++) {
      try {
        return await fn();
      } catch (err) {
        ultimo = err;
        if (i < tentativas - 1) {
          await new Promise((r) => setTimeout(r, 400 * (i + 1)));
        }
      }
    }
    throw ultimo;
  }

  async closeSession(): Promise<void> {
    if (this.session) {
      await this.session.close().catch(() => undefined);
      this.session = null;
    }
    if (this.browser) {
      await this.browser.close().catch(() => undefined);
      this.browser = null;
    }
  }

  protected async launchBrowserIfNeeded(): Promise<Browser> {
    if (this.browser) {
      return this.browser;
    }
    this.browser = await chromium.launch({
      headless: true,
      args: [...serverChromiumArgs],
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    });
    return this.browser;
  }

  protected async newContextIfNeeded(): Promise<BrowserContext> {
    const browser = await this.launchBrowserIfNeeded();
    if (!this.session) {
      this.session = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      });
    }
    return this.session;
  }
}

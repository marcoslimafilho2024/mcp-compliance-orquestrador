/**
 * tools/cfc.tools.ts
 * Busca e extração de Normas Brasileiras de Contabilidade (NBC) do CFC
 * Normas completas e normas simplificadas para PMEs
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

const CFC_BASE = 'https://cfc.org.br';

const CFC_URLS: Record<string, string> = {
  completas: `${CFC_BASE}/tecnica/normas-brasileiras-de-contabilidade/normas-completas/`,
  pmes: `${CFC_BASE}/tecnica/normas-brasileiras-de-contabilidade/normas-simplificadas-para-pmes/`,
};

interface NbcNorma {
  codigo: string;
  titulo: string;
  url: string;
  tipo: string;
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'pt-BR,pt;q=0.9',
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ao acessar ${url}`);
  return res.text();
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function resolveUrl(href: string): string {
  if (href.startsWith('http')) return href;
  if (href.startsWith('/')) return `${CFC_BASE}${href}`;
  return href;
}

function extractNormasFromHtml(html: string, tipo: string): NbcNorma[] {
  const normas: NbcNorma[] = [];
  const seen = new Set<string>();

  const linkRegex = /<a[^>]+href=["']([^"'#][^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1].trim();
    const rawText = stripHtml(match[2]).trim();

    if (!rawText || rawText.length < 4) continue;

    if (/^(Home|Início|Login|Sair|Buscar|Menu|Voltar|Topo|Contato|CFC)$/i.test(rawText)) continue;

    const isNbc =
      /\bNBC\s*(TG|TA|TO|PA|PG|PP|TR|ITG|CTG|TSP|ATP)\b/i.test(rawText) ||
      /norma\s+brasileira\s+de\s+contabilidade/i.test(rawText);

    if (!isNbc) continue;

    const url = resolveUrl(href);
    if (seen.has(url)) continue;
    seen.add(url);

    const codigoMatch = rawText.match(
      /NBC\s*(TG|TA|TO|PA|PG|PP|TR|ITG|CTG|TSP|ATP)\s*(\d{0,4}(?:\s*\(R\d+\))?)/i,
    );
    const codigo = codigoMatch ? codigoMatch[0].toUpperCase().replace(/\s+/g, ' ') : '';

    normas.push({ codigo, titulo: rawText, url, tipo });
  }

  return normas;
}

async function buscarEmTipo(tipo: string, query: string): Promise<NbcNorma[]> {
  const url = CFC_URLS[tipo];
  const html = await fetchHtml(url);
  const normas = extractNormasFromHtml(html, tipo);

  if (!query || query === '*') return normas;

  const q = query.toLowerCase();
  return normas.filter(
    (n) => n.titulo.toLowerCase().includes(q) || n.codigo.toLowerCase().includes(q),
  );
}

export function registerCfcTools(server: McpServer): void {
  server.registerTool(
    'pesquisar_cfc',
    {
      description:
        'Busca e extração de Normas Brasileiras de Contabilidade (NBC) no site do CFC. ' +
        'modo="buscar": lista NBCs por termo — cobre NBC TG, TA, PA e outras séries. ' +
        'modo="extrair": extrai texto completo de uma norma via URL obtida na busca.',
      inputSchema: {
        modo: z.enum(['buscar', 'extrair']).describe('"buscar" para listar normas | "extrair" para obter texto completo via URL'),
        query: z.string().optional().describe('Termo de busca (obrigatório para modo=buscar). Ex: "NBC TG 32", "estoques". Use "*" para listar todas.'),
        url: z.string().url().optional().describe('URL da norma NBC no CFC (obrigatório para modo=extrair)'),
        tipo: z
          .enum(['completas', 'pmes', 'todas'])
          .optional()
          .default('todas')
          .describe('"completas" (normas integrais), "pmes" (simplificadas para PMEs) ou "todas". Apenas para modo=buscar.'),
      },
    },
    async ({ modo, query, url, tipo = 'todas' }) => {
      if (modo === 'extrair') {
        try {
          if (!url) return { content: [{ type: 'text', text: 'url é obrigatório para modo=extrair' }], isError: true };
          const html = await fetchHtml(url);
          const mainMatch = html.match(
            /<(?:article|main|div[^>]+(?:content|conteudo|entry|post|norma)[^>]*)>([\s\S]*?)<\/(?:article|main|div)>/i,
          );
          const textoFinal = mainMatch ? stripHtml(mainMatch[1]) : stripHtml(html);
          return { content: [{ type: 'text', text: JSON.stringify({ ok: true, url, tamanho_chars: textoFinal.length, conteudo: textoFinal }, null, 2) }] };
        } catch (err) {
          return { content: [{ type: 'text', text: String(err) }], isError: true };
        }
      }

      if (!query) return { content: [{ type: 'text', text: 'query é obrigatório para modo=buscar' }], isError: true };
      try {
        let resultados: NbcNorma[] = [];
        if (tipo === 'todas') {
          const [completas, pmes] = await Promise.all([
            buscarEmTipo('completas', query).catch(() => [] as NbcNorma[]),
            buscarEmTipo('pmes', query).catch(() => [] as NbcNorma[]),
          ]);
          resultados = [...completas, ...pmes];
        } else {
          resultados = await buscarEmTipo(tipo, query);
        }
        if (resultados.length === 0) {
          return { content: [{ type: 'text', text: JSON.stringify({ ok: true, total: 0, query, tipo, resultados: [], aviso: 'Nenhuma norma encontrada.' }, null, 2) }] };
        }
        return { content: [{ type: 'text', text: JSON.stringify({ ok: true, total: resultados.length, query, tipo, resultados }, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: String(err) }], isError: true };
      }
    },
  );
}

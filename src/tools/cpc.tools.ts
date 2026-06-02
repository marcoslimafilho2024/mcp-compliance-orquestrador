/**
 * tools/cpc.tools.ts
 * Busca e extração de documentos do CPC (Comitê de Pronunciamentos Contábeis)
 * Pronunciamentos, Interpretações e Orientações
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

const CPC_BASE = 'https://www.cpc.org.br';

const CPC_URLS: Record<string, string> = {
  pronunciamentos: `${CPC_BASE}/CPC/Documentos-Emitidos/Pronunciamentos`,
  interpretacoes: `${CPC_BASE}/CPC/Documentos-Emitidos/Interpretacoes`,
  orientacoes: `${CPC_BASE}/CPC/Documentos-Emitidos/Orientacoes`,
};

type TipoCpc = 'pronunciamentos' | 'interpretacoes' | 'orientacoes' | 'todos';

interface CpcDocumento {
  numero: string;
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
  if (href.startsWith('/')) return `${CPC_BASE}${href}`;
  return href;
}

function extractDocumentosFromHtml(html: string, tipo: string): CpcDocumento[] {
  const docs: CpcDocumento[] = [];
  const seen = new Set<string>();

  const linkRegex = /<a[^>]+href=["']([^"'#][^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1].trim();
    const rawText = stripHtml(match[2]).trim();

    if (!rawText || rawText.length < 4) continue;

    if (/^(Home|Início|Login|Sair|Buscar|Search|Menu|Topo)$/i.test(rawText)) continue;

    const isCpcDoc =
      /\b(CPC|ICPC|OCPC)\s*\d{2}/i.test(rawText) ||
      /pronunciamento|interpretação|orientação|framework|estrutura conceitual/i.test(rawText);

    if (!isCpcDoc) continue;

    const url = resolveUrl(href);
    if (seen.has(url)) continue;
    seen.add(url);

    const numMatch = rawText.match(/\b(CPC|ICPC|OCPC)\s*(\d{2,3}(?:\s*\(R\d+\))?)/i);
    const numero = numMatch ? numMatch[0].toUpperCase().replace(/\s+/g, ' ') : '';

    docs.push({ numero, titulo: rawText, url, tipo });
  }

  return docs;
}

async function buscarEmTipo(tipo: string, query: string): Promise<CpcDocumento[]> {
  const url = CPC_URLS[tipo];
  const html = await fetchHtml(url);
  const docs = extractDocumentosFromHtml(html, tipo);

  if (!query || query === '*') return docs;

  const q = query.toLowerCase();
  return docs.filter(
    (d) => d.titulo.toLowerCase().includes(q) || d.numero.toLowerCase().includes(q),
  );
}

export function registerCpcTools(server: McpServer): void {
  server.registerTool(
    'buscar_cpc',
    {
      description:
        'Busca documentos do CPC (Pronunciamentos, Interpretações e Orientações Contábeis). ' +
        'Retorna lista com número, título e URL de cada documento encontrado. ' +
        'Use extrair_cpc(url) para obter o conteúdo completo.',
      inputSchema: {
        query: z
          .string()
          .describe(
            'Termo de busca — ex: "CPC 32", "tributos", "arrendamento", "instrumentos financeiros". ' +
              'Use "*" para listar todos.',
          ),
        tipo: z
          .enum(['pronunciamentos', 'interpretacoes', 'orientacoes', 'todos'])
          .optional()
          .default('todos')
          .describe(
            '"pronunciamentos" (CPC 01–50), "interpretacoes" (ICPC), "orientacoes" (OCPC) ou "todos".',
          ),
      },
    },
    async ({ query, tipo = 'todos' }) => {
      try {
        let resultados: CpcDocumento[] = [];

        if (tipo === 'todos') {
          const [pron, interp, orient] = await Promise.all([
            buscarEmTipo('pronunciamentos', query).catch(() => [] as CpcDocumento[]),
            buscarEmTipo('interpretacoes', query).catch(() => [] as CpcDocumento[]),
            buscarEmTipo('orientacoes', query).catch(() => [] as CpcDocumento[]),
          ]);
          resultados = [...pron, ...interp, ...orient];
        } else {
          resultados = await buscarEmTipo(tipo as TipoCpc, query);
        }

        if (resultados.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  { ok: true, total: 0, query, tipo, resultados: [], aviso: 'Nenhum documento encontrado.' },
                  null,
                  2,
                ),
              },
            ],
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ ok: true, total: resultados.length, query, tipo, resultados }, null, 2),
            },
          ],
        };
      } catch (err) {
        return { content: [{ type: 'text', text: String(err) }], isError: true };
      }
    },
  );

  server.registerTool(
    'extrair_cpc',
    {
      description:
        'Extrai o conteúdo completo de um documento do CPC a partir da URL. ' +
        'Retorna o texto limpo (sem HTML) com o conteúdo do pronunciamento, interpretação ou orientação.',
      inputSchema: {
        url: z
          .string()
          .url()
          .describe('URL completa do documento CPC — obtida via buscar_cpc.'),
      },
    },
    async ({ url }) => {
      try {
        const html = await fetchHtml(url);
        const texto = stripHtml(html);

        const mainMatch = html.match(
          /<(?:article|main|div[^>]+(?:content|conteudo|corpo|body)[^>]*)>([\s\S]*?)<\/(?:article|main|div)>/i,
        );
        const textoFinal = mainMatch ? stripHtml(mainMatch[1]) : texto;

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                { ok: true, url, tamanho_chars: textoFinal.length, conteudo: textoFinal },
                null,
                2,
              ),
            },
          ],
        };
      } catch (err) {
        return { content: [{ type: 'text', text: String(err) }], isError: true };
      }
    },
  );
}

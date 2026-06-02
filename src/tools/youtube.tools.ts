/**
 * tools/youtube.tools.ts
 * Busca de vídeos no YouTube via YouTube Data API v3
 * Canais: Prof. Edson Pinzon, Prof. Pegas, Contabilidade Facilitada
 * Variável de ambiente necessária: YOUTUBE_API_KEY
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

const YT_API_BASE = 'https://www.googleapis.com/youtube/v3';

const CANAIS: Record<string, { nome: string; channelId?: string; handle?: string }> = {
  profpinzon: {
    nome: 'Prof. Edson Pinzon',
    handle: 'profpinzon',
  },
  profpegas: {
    nome: 'Prof. Paulo Henrique Pegas',
    channelId: 'UCBmKmcCtjgDOf1evsAd8rjQ',
  },
  contabilidadefacilitada: {
    nome: 'Contabilidade Facilitada',
    handle: 'contabilidadefacilitada',
  },
};

interface VideoResult {
  videoId: string;
  titulo: string;
  canal: string;
  url: string;
  publicado: string;
  descricao: string;
  thumbnail: string;
}

function getApiKey(): string {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error('YOUTUBE_API_KEY não configurada nas variáveis de ambiente do Railway.');
  return key;
}

async function resolveChannelId(handle: string): Promise<string> {
  const key = getApiKey();
  const url = `${YT_API_BASE}/channels?part=id&forHandle=${encodeURIComponent(handle)}&key=${key}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`YouTube API erro ${res.status} ao resolver handle @${handle}`);
  const data = (await res.json()) as { items?: Array<{ id: string }> };
  if (!data.items || data.items.length === 0) {
    throw new Error(`Handle @${handle} não encontrado no YouTube.`);
  }
  return data.items[0].id;
}

async function getChannelId(canal: string): Promise<string | undefined> {
  const info = CANAIS[canal];
  if (!info) return undefined;
  if (info.channelId) return info.channelId;
  if (info.handle) {
    const resolved = await resolveChannelId(info.handle);
    info.channelId = resolved;
    return resolved;
  }
  return undefined;
}

async function searchVideos(query: string, channelId?: string, maxResults = 10): Promise<VideoResult[]> {
  const key = getApiKey();

  const params = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    q: query,
    maxResults: String(maxResults),
    relevanceLanguage: 'pt',
    key,
  });

  if (channelId) params.set('channelId', channelId);

  const url = `${YT_API_BASE}/search?${params.toString()}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`YouTube API erro ${res.status}: ${body}`);
  }

  const data = (await res.json()) as {
    items: Array<{
      id: { videoId: string };
      snippet: {
        title: string;
        channelTitle: string;
        publishedAt: string;
        description: string;
        thumbnails: { medium?: { url: string }; default?: { url: string } };
      };
    }>;
  };

  return (data.items ?? []).map((item) => ({
    videoId: item.id.videoId,
    titulo: item.snippet.title,
    canal: item.snippet.channelTitle,
    url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
    publicado: item.snippet.publishedAt.slice(0, 10),
    descricao: item.snippet.description.slice(0, 300),
    thumbnail: item.snippet.thumbnails.medium?.url ?? item.snippet.thumbnails.default?.url ?? '',
  }));
}

export function registerYoutubeTools(server: McpServer): void {
  server.registerTool(
    'buscar_youtube',
    {
      description:
        'Busca vídeos no YouTube sobre contabilidade, tributação e reforma tributária. ' +
        'Canais disponíveis: profpinzon (Prof. Edson Pinzon), profpegas (Prof. Paulo Pegas), ' +
        'contabilidadefacilitada (Contabilidade Facilitada) ou "todos" para qualquer canal. ' +
        'Requer YOUTUBE_API_KEY configurada no Railway.',
      inputSchema: {
        query: z
          .string()
          .describe(
            'Termo de busca — ex: "IBS CBS contabilização", "CPC 47 receitas", ' +
              '"reforma tributária Simples Nacional", "NBC TG 32 tributos".',
          ),
        canal: z
          .enum(['profpinzon', 'profpegas', 'contabilidadefacilitada', 'todos'])
          .optional()
          .default('todos')
          .describe(
            '"profpinzon" (Prof. Edson Pinzon), "profpegas" (Prof. Paulo Pegas), ' +
              '"contabilidadefacilitada" (Contabilidade Facilitada) ou "todos" (qualquer canal).',
          ),
        max_resultados: z
          .number()
          .int()
          .min(1)
          .max(25)
          .optional()
          .default(8)
          .describe('Número máximo de vídeos a retornar (1–25). Padrão: 8.'),
      },
    },
    async ({ query, canal = 'todos', max_resultados = 8 }) => {
      try {
        let videos: VideoResult[] = [];

        if (canal === 'todos') {
          videos = await searchVideos(query, undefined, max_resultados);
        } else {
          const channelId = await getChannelId(canal);
          videos = await searchVideos(query, channelId, max_resultados);
        }

        const canalNome = canal === 'todos' ? 'Todos os canais' : (CANAIS[canal]?.nome ?? canal);

        if (videos.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  { ok: true, total: 0, query, canal: canalNome, videos: [], aviso: `Nenhum vídeo encontrado para "${query}".` },
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
              text: JSON.stringify({ ok: true, total: videos.length, query, canal: canalNome, videos }, null, 2),
            },
          ],
        };
      } catch (err) {
        return { content: [{ type: 'text', text: String(err) }], isError: true };
      }
    },
  );
}

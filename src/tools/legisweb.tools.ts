import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { LegiswebAgent } from '../agents/legisweb.agent.js';

export function registerLegiswebTools(server: McpServer, agent: LegiswebAgent): void {
  server.registerTool(
    'pesquisar_legisweb',
    {
      description:
        'Busca e extração de legislação no Legisweb (sessão autenticada). ' +
        'modo="buscar": pesquisa por termos, retorna lista de resultados. ' +
        'modo="extrair": extrai texto completo de uma URL retornada pela busca.',
      inputSchema: {
        modo: z.enum(['buscar', 'extrair']).describe('"buscar" para listar resultados | "extrair" para obter texto completo via URL'),
        query: z.string().min(1).optional().describe('Termos de busca (obrigatório para modo=buscar)'),
        url: z.string().url().optional().describe('URL absoluta do conteúdo (obrigatório para modo=extrair)'),
        paginas: z.number().int().min(1).max(10).optional().describe('Páginas de resultados a percorrer (modo=buscar, padrão 1)'),
      },
    },
    async ({ modo, query, url, paginas }) => {
      try {
        if (modo === 'buscar') {
          if (!query) return { content: [{ type: 'text', text: 'query é obrigatório para modo=buscar' }], isError: true };
          const resultados = await agent.buscar(query, { paginas });
          return { content: [{ type: 'text', text: JSON.stringify(resultados, null, 2) }] };
        } else {
          if (!url) return { content: [{ type: 'text', text: 'url é obrigatório para modo=extrair' }], isError: true };
          const texto = await agent.extrairConteudo(url);
          return { content: [{ type: 'text', text: texto }] };
        }
      } catch (err) {
        return { content: [{ type: 'text', text: err instanceof Error ? err.message : String(err) }], isError: true };
      }
    },
  );
}

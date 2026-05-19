import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { LegiswebAgent } from '../agents/legisweb.agent.js';

export function registerLegiswebTools(server: McpServer, agent: LegiswebAgent): void {
  server.registerTool(
    'buscar_legisweb',
    {
      description: 'Busca legislação e materiais no Legisweb (sessão autenticada no servidor).',
      inputSchema: {
        query: z.string().min(1).describe('Termos de busca'),
        paginas: z
          .number()
          .int()
          .min(1)
          .max(10)
          .optional()
          .describe(
            'Quantas páginas de resultados percorrer (1 = só a primeira). Cada página extra clica em "Próxima" na barra de paginação. Máximo 10.',
          ),
      },
    },
    async ({ query, paginas }) => {
      try {
        const resultados = await agent.buscar(query, { paginas });
        return {
          content: [{ type: 'text', text: JSON.stringify(resultados, null, 2) }],
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text', text: msg }],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    'extrair_legisweb',
    {
      description: 'Extrai o texto completo de uma página do Legisweb a partir da URL.',
      inputSchema: {
        url: z.string().url().describe('URL absoluta do conteúdo no Legisweb'),
      },
    },
    async ({ url }) => {
      try {
        const texto = await agent.extrairConteudo(url);
        return {
          content: [{ type: 'text', text: texto }],
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text', text: msg }],
          isError: true,
        };
      }
    },
  );
}

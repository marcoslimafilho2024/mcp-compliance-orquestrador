import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { TaxPraticoAgent } from '../agents/taxpratico.agent.js';

export function registerTaxPraticoTools(server: McpServer, agent: TaxPraticoAgent): void {
  server.registerTool(
    'buscar_taxpratico',
    {
      description:
        'Busca procedimentos e conteúdo no Tax Prático (sessão autenticada no servidor). Opcional: filtro apenas CEARÁ.',
      inputSchema: {
        query: z.string().min(1).describe('Termos de busca'),
        filtro_ceara: z
          .boolean()
          .optional()
          .describe(
            'Se true, aplica o filtro de UF CEARÁ (dropdown no header) antes de pesquisar.',
          ),
      },
    },
    async ({ query, filtro_ceara }) => {
      try {
        const resultados = await agent.buscar(query, { filtroCeara: filtro_ceara === true });
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
    'extrair_taxpratico',
    {
      description: 'Extrai o texto completo de uma página do Tax Prático a partir da URL.',
      inputSchema: {
        url: z.string().url().describe('URL absoluta do conteúdo no Tax Prático'),
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

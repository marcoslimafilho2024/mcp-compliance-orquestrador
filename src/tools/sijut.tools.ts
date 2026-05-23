import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { SijutAgent } from '../agents/sijut.agent.js';

export function registerSijutTools(server: McpServer, agent: SijutAgent): void {
  server.registerTool(
    'buscar_sijut',
    {
      description:
        'Busca normas da Receita Federal no SIJUT (portal aberto, sem autenticação). Por padrão retorna apenas atos vigentes.',
      inputSchema: {
        query: z.string().min(1).describe('Termos de busca (ex.: "IN RFB 2121", "IBS CBS reforma tributária")'),
        paginas: z
          .number()
          .int()
          .min(1)
          .max(10)
          .optional()
          .describe('Quantas páginas de resultados percorrer (padrão 1, máximo 10)'),
        apenas_vigentes: z
          .boolean()
          .optional()
          .describe('Se false, inclui também atos revogados/históricos (padrão true — somente vigentes)'),
      },
    },
    async ({ query, paginas, apenas_vigentes }) => {
      try {
        const resultados = await agent.buscar(query, {
          paginas,
          apenasVigentes: apenas_vigentes !== false,
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(resultados, null, 2) }],
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text', text: msg }], isError: true };
      }
    },
  );

  server.registerTool(
    'extrair_sijut',
    {
      description: 'Extrai o texto completo de uma norma da Receita Federal a partir da URL do SIJUT.',
      inputSchema: {
        url: z.string().url().describe('URL absoluta da norma no SIJUT / normas.receita.fazenda.gov.br'),
      },
    },
    async ({ url }) => {
      try {
        const texto = await agent.extrairConteudo(url);
        return { content: [{ type: 'text', text: texto }] };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text', text: msg }], isError: true };
      }
    },
  );
}

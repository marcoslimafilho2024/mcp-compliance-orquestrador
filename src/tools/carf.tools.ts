import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { CarfAgent } from '../agents/carf.agent.js';

export function registerCarfTools(server: McpServer, agent: CarfAgent): void {
  server.registerTool(
    'buscar_carf',
    {
      description:
        'Busca acórdãos e jurisprudência no CARF (Conselho Administrativo de Recursos Fiscais). Portal público, sem autenticação. Use operadores: [e] AND, [ou] OR, [não] NOT, [$] curinga, [ADJ] adjacente.',
      inputSchema: {
        query: z
          .string()
          .min(1)
          .describe(
            'Termos de busca. Ex: "IBS CBS reforma tributária", "IRPJ lucro presumido [e] distribuição de lucros"',
          ),
        paginas: z
          .number()
          .int()
          .min(1)
          .max(10)
          .optional()
          .describe('Quantas páginas de resultados percorrer (padrão 1, máximo 10)'),
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
        return { content: [{ type: 'text', text: msg }], isError: true };
      }
    },
  );

  server.registerTool(
    'extrair_carf',
    {
      description: 'Extrai o texto completo de um acórdão do CARF a partir da URL.',
      inputSchema: {
        url: z
          .string()
          .url()
          .describe('URL absoluta do acórdão no portal CARF (carf.fazenda.gov.br)'),
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

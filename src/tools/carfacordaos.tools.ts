import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { CarfAcordaosAgent } from '../agents/carfacordaos.agent.js';

export function registerCarfAcordaosTools(server: McpServer, agent: CarfAcordaosAgent): void {
  server.registerTool(
    'buscar_carf_acordaos',
    {
      description:
        'Busca acórdãos no portal acordaos.economia.gov.br (base Solr do CARF/PGFN). Retorna lista com título e URL de cada acórdão encontrado.',
      inputSchema: {
        query: z
          .string()
          .min(1)
          .describe('Termos de busca. Ex: "aluguel PIS COFINS", "IRPJ distribuição de lucros"'),
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
    'extrair_carf_acordaos',
    {
      description:
        'Extrai o texto completo de um acórdão a partir da URL retornada por buscar_carf_acordaos.',
      inputSchema: {
        url: z
          .string()
          .url()
          .describe('URL absoluta do acórdão em acordaos.economia.gov.br'),
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

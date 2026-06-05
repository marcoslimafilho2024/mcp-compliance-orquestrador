import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { TaxPraticoAgent } from '../agents/taxpratico.agent.js';

export function registerTaxPraticoTools(server: McpServer, agent: TaxPraticoAgent): void {
  server.registerTool(
    'pesquisar_taxpratico',
    {
      description:
        'Busca e extração de procedimentos e conteúdo no Tax Prático (sessão autenticada). ' +
        'modo="buscar": pesquisa por termos, com filtro opcional de UF Ceará. ' +
        'modo="extrair": extrai texto completo de uma URL retornada pela busca.',
      inputSchema: {
        modo: z.enum(['buscar', 'extrair']).describe('"buscar" para listar resultados | "extrair" para obter texto completo via URL'),
        query: z.string().min(1).optional().describe('Termos de busca (obrigatório para modo=buscar)'),
        url: z.string().url().optional().describe('URL absoluta do conteúdo (obrigatório para modo=extrair)'),
        filtro_ceara: z.boolean().optional().describe('Se true, aplica filtro de UF CEARÁ (modo=buscar)'),
      },
    },
    async ({ modo, query, url, filtro_ceara }) => {
      try {
        if (modo === 'buscar') {
          if (!query) return { content: [{ type: 'text', text: 'query é obrigatório para modo=buscar' }], isError: true };
          const resultados = await agent.buscar(query, { filtroCeara: filtro_ceara === true });
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

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { SijutAgent } from '../agents/sijut.agent.js';

export function registerSijutTools(server: McpServer, agent: SijutAgent): void {
  server.registerTool(
    'pesquisar_sijut',
    {
      description:
        'Busca e extração de normas da Receita Federal no SIJUT (portal aberto). ' +
        'modo="buscar": pesquisa por termos, por padrão retorna apenas atos vigentes. ' +
        'modo="extrair": extrai texto completo de uma norma via URL.',
      inputSchema: {
        modo: z.enum(['buscar', 'extrair']).describe('"buscar" para listar normas | "extrair" para obter texto completo via URL'),
        query: z.string().min(1).optional().describe('Termos de busca (obrigatório para modo=buscar). Ex: "IN RFB 2121", "IBS CBS"'),
        url: z.string().url().optional().describe('URL da norma em normas.receita.fazenda.gov.br (obrigatório para modo=extrair)'),
        paginas: z.number().int().min(1).max(10).optional().describe('Páginas de resultados (modo=buscar, padrão 1)'),
        apenas_vigentes: z.boolean().optional().describe('false para incluir atos revogados/históricos (padrão true)'),
      },
    },
    async ({ modo, query, url, paginas, apenas_vigentes }) => {
      try {
        if (modo === 'buscar') {
          if (!query) return { content: [{ type: 'text', text: 'query é obrigatório para modo=buscar' }], isError: true };
          const resultados = await agent.buscar(query, { paginas, apenasVigentes: apenas_vigentes !== false });
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

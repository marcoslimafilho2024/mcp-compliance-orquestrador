import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { KeepAgent } from '../agents/keep.agent.js';

export function registerKeepTools(server: McpServer, agent: KeepAgent): void {
  server.registerTool(
    'keep_listar_notas',
    {
      description:
        'Lista notas do Google Keep. Retorna título e conteúdo das notas. ' +
        'Use filtro para buscar por texto.',
      inputSchema: {
        filtro: z
          .string()
          .optional()
          .describe('Texto para filtrar notas. Omita para listar todas.'),
      },
    },
    async ({ filtro }) => {
      try {
        const notas = await agent.listarNotas(filtro);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ total: notas.length, notas }, null, 2),
            },
          ],
        };
      } catch (err) {
        return { content: [{ type: 'text', text: String(err) }], isError: true };
      }
    },
  );

  server.registerTool(
    'keep_criar_nota',
    {
      description:
        'Cria uma nova nota no Google Keep. Pode ser nota de texto simples ou checklist com itens.',
      inputSchema: {
        titulo: z.string().optional().describe('Título da nota (opcional)'),
        conteudo: z
          .string()
          .optional()
          .describe('Texto da nota. Use este OU itens_checklist, não os dois.'),
        itens_checklist: z
          .array(z.string())
          .optional()
          .describe('Lista de itens para criar uma checklist. Use este OU conteudo, não os dois.'),
      },
    },
    async ({ titulo, conteudo, itens_checklist }) => {
      try {
        const nota = await agent.criarNota(
          titulo ?? '',
          conteudo ?? '',
          itens_checklist,
        );
        return {
          content: [{ type: 'text', text: JSON.stringify(nota, null, 2) }],
        };
      } catch (err) {
        return { content: [{ type: 'text', text: String(err) }], isError: true };
      }
    },
  );
}

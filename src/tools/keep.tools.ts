import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { google, type keep_v1 } from 'googleapis';
import { z } from 'zod';

function getKeepClient() {
  const clientId = process.env.GOOGLE_KEEP_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_KEEP_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_KEEP_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      'Variáveis de ambiente ausentes: GOOGLE_KEEP_CLIENT_ID, GOOGLE_KEEP_CLIENT_SECRET e ' +
      'GOOGLE_KEEP_REFRESH_TOKEN devem estar configuradas no Railway. ' +
      'Gere o refresh token via OAuth 2.0 Playground (https://developers.google.com/oauthplayground) ' +
      'com o escopo https://www.googleapis.com/auth/keep',
    );
  }

  const auth = new google.auth.OAuth2(clientId, clientSecret);
  auth.setCredentials({ refresh_token: refreshToken });
  return google.keep({ version: 'v1', auth });
}

function formatarNota(nota: keep_v1.Schema$Note): Record<string, unknown> {
  const body = nota.body;
  let conteudo: unknown = null;

  if (body?.text?.text) {
    conteudo = body.text.text;
  } else if (body?.list?.listItems) {
    conteudo = body.list.listItems.map((item) => ({
      texto: item.text?.text ?? '',
      marcado: item.checked ?? false,
    }));
  }

  return {
    id: nota.name,
    titulo: nota.title ?? '(sem título)',
    conteudo,
    criado_em: nota.createTime,
    atualizado_em: nota.updateTime,
    na_lixeira: nota.trashed ?? false,
  };
}

export function registerKeepTools(server: McpServer): void {
  server.registerTool(
    'keep_listar_notas',
    {
      description:
        'Lista notas do Google Keep. Retorna título, conteúdo, labels e data de atualização. ' +
        'Use filtro para buscar por texto no conteúdo.',
      inputSchema: {
        filtro: z
          .string()
          .optional()
          .describe('Texto para filtrar notas (busca no título e corpo). Omita para listar todas.'),
        max_resultados: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .default(20)
          .describe('Número máximo de notas a retornar (padrão: 20, máximo: 100)'),
      },
    },
    async ({ filtro, max_resultados }) => {
      try {
        const keep = getKeepClient();
        const params: keep_v1.Params$Resource$Notes$List = { pageSize: max_resultados };
        if (filtro) params.filter = filtro;

        const { data } = await keep.notes.list(params);
        const notas = (data.notes ?? []).map(formatarNota);

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
    'keep_obter_nota',
    {
      description: 'Obtém uma nota específica do Google Keep pelo seu ID (ex: "notes/abc123xyz").',
      inputSchema: {
        nota_id: z
          .string()
          .describe('ID da nota no formato "notes/ID" ou apenas o ID sem o prefixo'),
      },
    },
    async ({ nota_id }) => {
      try {
        const keep = getKeepClient();
        const name = nota_id.startsWith('notes/') ? nota_id : `notes/${nota_id}`;
        const { data } = await keep.notes.get({ name });
        return {
          content: [{ type: 'text', text: JSON.stringify(formatarNota(data), null, 2) }],
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
        'Cria uma nova nota no Google Keep. Pode ser nota de texto simples ou checklist.',
      inputSchema: {
        titulo: z.string().optional().describe('Título da nota (opcional)'),
        texto: z
          .string()
          .optional()
          .describe('Conteúdo da nota em texto simples. Use este OU itens_checklist, não os dois.'),
        itens_checklist: z
          .array(
            z.object({
              texto: z.string().describe('Texto do item'),
              marcado: z.boolean().optional().default(false).describe('Se o item está marcado'),
            }),
          )
          .optional()
          .describe('Itens para criar uma nota de checklist. Use este OU texto, não os dois.'),
      },
    },
    async ({ titulo, texto, itens_checklist }) => {
      try {
        const keep = getKeepClient();

        const requestBody: keep_v1.Schema$Note = {};
        if (titulo) requestBody.title = titulo;

        if (itens_checklist && itens_checklist.length > 0) {
          requestBody.body = {
            list: {
              listItems: itens_checklist.map((item) => ({
                text: { text: item.texto },
                checked: item.marcado ?? false,
              })),
            },
          };
        } else if (texto) {
          requestBody.body = { text: { text: texto } };
        }

        const { data } = await keep.notes.create({ requestBody });
        return {
          content: [{ type: 'text', text: JSON.stringify(formatarNota(data), null, 2) }],
        };
      } catch (err) {
        return { content: [{ type: 'text', text: String(err) }], isError: true };
      }
    },
  );

  server.registerTool(
    'keep_deletar_nota',
    {
      description:
        'Deleta (move para a lixeira) uma nota do Google Keep pelo seu ID. ' +
        'Notas na lixeira são removidas permanentemente após 7 dias.',
      inputSchema: {
        nota_id: z
          .string()
          .describe('ID da nota no formato "notes/ID" ou apenas o ID sem o prefixo'),
      },
    },
    async ({ nota_id }) => {
      try {
        const keep = getKeepClient();
        const name = nota_id.startsWith('notes/') ? nota_id : `notes/${nota_id}`;
        await keep.notes.delete({ name });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ sucesso: true, nota_id: name, acao: 'movida para lixeira' }),
            },
          ],
        };
      } catch (err) {
        return { content: [{ type: 'text', text: String(err) }], isError: true };
      }
    },
  );
}

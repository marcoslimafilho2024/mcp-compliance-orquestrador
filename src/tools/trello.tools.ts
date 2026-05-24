import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

const TRELLO_BASE = 'https://api.trello.com/1';

function trelloAuth(): string {
  const key = process.env.TRELLO_API_KEY;
  const token = process.env.TRELLO_TOKEN;
  if (!key || !token) throw new Error('TRELLO_API_KEY e TRELLO_TOKEN sao obrigatorios');
  return `key=${key}&token=${token}`;
}

async function trelloGet(path: string): Promise<unknown> {
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`${TRELLO_BASE}${path}${sep}${trelloAuth()}`);
  if (!res.ok) throw new Error(`Trello ${res.status}: ${await res.text()}`);
  return res.json();
}

async function trelloPost(path: string, body: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(`${TRELLO_BASE}${path}?${trelloAuth()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Trello ${res.status}: ${await res.text()}`);
  return res.json();
}

async function trelloPut(path: string, body: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(`${TRELLO_BASE}${path}?${trelloAuth()}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Trello ${res.status}: ${await res.text()}`);
  return res.json();
}

async function trelloDelete(path: string): Promise<unknown> {
  const res = await fetch(`${TRELLO_BASE}${path}?${trelloAuth()}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`Trello ${res.status}: ${await res.text()}`);
  return res.json();
}

export function registerTrelloTools(server: McpServer): void {
  server.registerTool(
    'trello_listar_boards',
    {
      description: 'Lista todos os boards do Trello do usuario autenticado com id, nome e URL.',
      inputSchema: {},
    },
    async () => {
      try {
        const boards = await trelloGet('/members/me/boards?fields=id,name,shortUrl,closed');
        return { content: [{ type: 'text', text: JSON.stringify(boards, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: String(err) }], isError: true };
      }
    },
  );

  server.registerTool(
    'trello_buscar_board',
    {
      description: 'Busca um board do Trello pelo nome (parcial) e retorna seu id e listas. Use antes de criar/editar cards.',
      inputSchema: {
        nome: z.string().describe('Nome ou parte do nome do board'),
      },
    },
    async ({ nome }) => {
      try {
        const boards = await trelloGet('/members/me/boards?fields=id,name,shortUrl') as Array<{ id: string; name: string; shortUrl: string }>;
        const matches = boards.filter((b) => b.name.toLowerCase().includes(nome.toLowerCase()));
        if (matches.length === 0) {
          return { content: [{ type: 'text', text: `Nenhum board encontrado com o nome "${nome}"` }] };
        }
        const result = await Promise.all(
          matches.map(async (b) => ({
            ...b,
            listas: await trelloGet(`/boards/${b.id}/lists?fields=id,name,pos`),
          })),
        );
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: String(err) }], isError: true };
      }
    },
  );

  server.registerTool(
    'trello_listar_listas',
    {
      description: 'Lista todas as listas de um board do Trello.',
      inputSchema: {
        board_id: z.string().describe('ID do board no Trello'),
      },
    },
    async ({ board_id }) => {
      try {
        const listas = await trelloGet(`/boards/${board_id}/lists?fields=id,name,pos,closed`);
        return { content: [{ type: 'text', text: JSON.stringify(listas, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: String(err) }], isError: true };
      }
    },
  );

  server.registerTool(
    'trello_listar_cards',
    {
      description: 'Lista todos os cards de uma lista do Trello.',
      inputSchema: {
        list_id: z.string().describe('ID da lista no Trello'),
      },
    },
    async ({ list_id }) => {
      try {
        const cards = await trelloGet(`/lists/${list_id}/cards?fields=id,name,desc,due,url,closed,labels`);
        return { content: [{ type: 'text', text: JSON.stringify(cards, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: String(err) }], isError: true };
      }
    },
  );

  server.registerTool(
    'trello_criar_card',
    {
      description: 'Cria um novo card em uma lista do Trello.',
      inputSchema: {
        list_id: z.string().describe('ID da lista onde o card sera criado'),
        nome: z.string().describe('Titulo do card'),
        descricao: z.string().optional().describe('Descricao do card (aceita markdown)'),
        vencimento: z.string().optional().describe('Data de vencimento ISO 8601 (ex: 2025-12-31T23:59:00Z)'),
      },
    },
    async ({ list_id, nome, descricao, vencimento }) => {
      try {
        const body: Record<string, unknown> = { idList: list_id, name: nome };
        if (descricao) body.desc = descricao;
        if (vencimento) body.due = vencimento;
        const card = await trelloPost('/cards', body);
        return { content: [{ type: 'text', text: JSON.stringify(card, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: String(err) }], isError: true };
      }
    },
  );

  server.registerTool(
    'trello_atualizar_card',
    {
      description: 'Atualiza nome, descricao, vencimento ou lista de um card. Campos omitidos nao sao alterados.',
      inputSchema: {
        card_id: z.string().describe('ID do card no Trello'),
        nome: z.string().optional().describe('Novo titulo do card'),
        descricao: z.string().optional().describe('Nova descricao do card'),
        vencimento: z.string().optional().describe('Nova data de vencimento ISO 8601'),
        list_id: z.string().optional().describe('ID da lista destino (para mover o card)'),
        fechado: z.boolean().optional().describe('true para arquivar, false para desarquivar'),
      },
    },
    async ({ card_id, nome, descricao, vencimento, list_id, fechado }) => {
      try {
        const body: Record<string, unknown> = {};
        if (nome !== undefined) body.name = nome;
        if (descricao !== undefined) body.desc = descricao;
        if (vencimento !== undefined) body.due = vencimento;
        if (list_id !== undefined) body.idList = list_id;
        if (fechado !== undefined) body.closed = fechado;
        const card = await trelloPut(`/cards/${card_id}`, body);
        return { content: [{ type: 'text', text: JSON.stringify(card, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: String(err) }], isError: true };
      }
    },
  );

  server.registerTool(
    'trello_deletar_card',
    {
      description: 'Deleta permanentemente um card do Trello. Acao irreversivel.',
      inputSchema: {
        card_id: z.string().describe('ID do card a ser deletado'),
      },
    },
    async ({ card_id }) => {
      try {
        const result = await trelloDelete(`/cards/${card_id}`);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: String(err) }], isError: true };
      }
    },
  );
}
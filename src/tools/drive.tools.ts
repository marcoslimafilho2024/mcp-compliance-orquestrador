import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

function getToken(): string {
  const token = process.env.GOOGLE_ACCESS_TOKEN;
  if (!token) throw new Error('Variável GOOGLE_ACCESS_TOKEN não configurada no Railway.');
  return token;
}

export function registerDriveTools(server: McpServer): void {
  server.registerTool(
    'drive_deletar_arquivo',
    {
      description:
        'Move um arquivo do Google Drive para a lixeira (padrão) ou deleta permanentemente. ' +
        'Requer GOOGLE_ACCESS_TOKEN configurado no Railway. ' +
        'Use permanente=false (padrão) para poder recuperar depois.',
      inputSchema: {
        file_id: z.string().describe('ID do arquivo no Google Drive (ex: 1YLJwYC5xXXmsB1LDKXVvSLbicLBNTqbd)'),
        permanente: z
          .boolean()
          .optional()
          .default(false)
          .describe('false = move para lixeira (recuperável) | true = deleta permanentemente'),
      },
    },
    async ({ file_id, permanente }) => {
      const token = getToken();
      const base = `https://www.googleapis.com/drive/v3/files/${file_id}`;

      let response: Response;

      if (permanente) {
        response = await fetch(base, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
      } else {
        response = await fetch(base, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ trashed: true }),
        });
      }

      if (response.status === 204 || response.ok) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                sucesso: true,
                file_id,
                acao: permanente ? 'deletado permanentemente' : 'movido para lixeira',
              }),
            },
          ],
        };
      }

      const erro = await response.text();
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              sucesso: false,
              file_id,
              status: response.status,
              erro,
            }),
          },
        ],
      };
    },
  );
}

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { google } from 'googleapis';
import { z } from 'zod';

function getDriveClient() {
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!keyJson) {
    throw new Error(
      'GOOGLE_SERVICE_ACCOUNT_JSON não configurado no Railway. ' +
      'Crie um service account no Google Cloud Console, baixe o JSON da chave e cole como valor desta variável de ambiente.',
    );
  }
  const credentials = JSON.parse(keyJson);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  return google.drive({ version: 'v3', auth });
}

export function registerDriveTools(server: McpServer): void {
  server.registerTool(
    'drive_deletar_arquivo',
    {
      description:
        'Move um arquivo do Google Drive para a lixeira (padrão) ou deleta permanentemente. ' +
        'Usa service account — requer GOOGLE_SERVICE_ACCOUNT_JSON no Railway. ' +
        'O arquivo deve estar compartilhado com o e-mail do service account.',
      inputSchema: {
        file_id: z.string().describe('ID do arquivo no Google Drive'),
        permanente: z
          .boolean()
          .optional()
          .default(false)
          .describe('false = lixeira (recuperável) | true = deleção permanente'),
      },
    },
    async ({ file_id, permanente }) => {
      const drive = getDriveClient();

      if (permanente) {
        await drive.files.delete({ fileId: file_id });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ sucesso: true, file_id, acao: 'deletado permanentemente' }),
            },
          ],
        };
      }

      const { data } = await drive.files.update({
        fileId: file_id,
        requestBody: { trashed: true },
        fields: 'id,name,trashed',
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ sucesso: true, file_id, nome: data.name, acao: 'movido para lixeira' }),
          },
        ],
      };
    },
  );
}

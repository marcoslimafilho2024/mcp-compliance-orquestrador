// src/tools/gmail.tools.ts
// Ferramentas Gmail para o MCP Compliance Orquestrador
// Autenticação: GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET + GOOGLE_REFRESH_TOKEN
// Access tokens são obtidos automaticamente via refresh e cacheados por 55 min.

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

const GMAIL_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';
const DRIVE_BASE = 'https://www.googleapis.com/drive/v3';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

// Cache em memória — reinicia quando o servidor reinicia (Railway redeploy)
let _tokenCache: { accessToken: string; expiresAt: number } | null = null;

async function getGoogleAccessToken(): Promise<string> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  // Fallback: tokens estáticos legados (retrocompatibilidade)
  if (!clientId || !clientSecret || !refreshToken) {
    const legacy = process.env.GMAIL_ACCESS_TOKEN ?? process.env.GOOGLE_ACCESS_TOKEN;
    if (legacy) return legacy;
    throw new Error(
      'Configure GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e GOOGLE_REFRESH_TOKEN no Railway ' +
        'para autenticação permanente.',
    );
  }

  // Retornar token cacheado se ainda válido (margem de 60 s)
  if (_tokenCache && _tokenCache.expiresAt > Date.now() + 60_000) {
    return _tokenCache.accessToken;
  }

  // Trocar refresh token por novo access token
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) {
    throw new Error(`Google token refresh falhou: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  _tokenCache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return _tokenCache.accessToken;
}

function bufferToBase64Url(buf: Buffer): string {
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

interface DriveFileMeta {
  name: string;
  mimeType: string;
}

async function getDriveFileMeta(fileId: string): Promise<DriveFileMeta> {
  const token = await getGoogleAccessToken();
  const res = await fetch(`${DRIVE_BASE}/files/${fileId}?fields=name,mimeType`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Drive meta ${fileId}: ${res.status} ${await res.text()}`);
  return res.json() as Promise<DriveFileMeta>;
}

async function getDriveFileContent(fileId: string): Promise<Buffer> {
  const token = await getGoogleAccessToken();
  const res = await fetch(`${DRIVE_BASE}/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Drive download ${fileId}: ${res.status} ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
}

function buildMimeMessage(params: {
  from: string;
  to: string[];
  cc?: string[];
  subject: string;
  htmlBody: string;
  attachments: Array<{ name: string; mimeType: string; content: Buffer }>;
}): string {
  const boundary = `boundary_mcp_${Date.now()}`;
  const lines: string[] = [];

  lines.push('MIME-Version: 1.0');
  lines.push(`From: ${params.from}`);
  lines.push(`To: ${params.to.join(', ')}`);
  if (params.cc && params.cc.length > 0) lines.push(`Cc: ${params.cc.join(', ')}`);
  // Assunto codificado em UTF-8 (RFC 2047)
  lines.push(`Subject: =?utf-8?B?${Buffer.from(params.subject, 'utf8').toString('base64')}?=`);
  lines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
  lines.push('');

  // Parte 1 — corpo HTML
  lines.push(`--${boundary}`);
  lines.push('Content-Type: text/html; charset=UTF-8');
  lines.push('Content-Transfer-Encoding: base64');
  lines.push('');
  lines.push(Buffer.from(params.htmlBody, 'utf8').toString('base64'));
  lines.push('');

  // Partes seguintes — anexos
  for (const att of params.attachments) {
    lines.push(`--${boundary}`);
    lines.push(`Content-Type: ${att.mimeType}; name="${att.name}"`);
    lines.push(`Content-Disposition: attachment; filename="${att.name}"`);
    lines.push('Content-Transfer-Encoding: base64');
    lines.push('');
    lines.push(att.content.toString('base64'));
    lines.push('');
  }

  lines.push(`--${boundary}--`);
  return lines.join('\r\n');
}

export function registerGmailTools(server: McpServer): void {
  server.registerTool(
    'gmail_criar_rascunho',
    {
      description:
        'Cria rascunho no Gmail com suporte a anexos de arquivos do Google Drive. ' +
        'Requer GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e GOOGLE_REFRESH_TOKEN no Railway.',
      inputSchema: {
        para: z.array(z.string()).describe('Lista de emails destinatários'),
        cc: z.array(z.string()).optional().describe('Lista de emails em cópia'),
        assunto: z.string().describe('Assunto do email'),
        corpo_html: z.string().describe('Corpo do email em HTML'),
        drive_file_ids: z
          .array(z.string())
          .optional()
          .describe('IDs de arquivos no Google Drive para anexar'),
      },
    },
    async ({ para, cc, assunto, corpo_html, drive_file_ids }) => {
      try {
        const token = await getGoogleAccessToken();

        // Obter endereço do remetente via perfil Gmail
        const profileRes = await fetch(`${GMAIL_BASE}/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!profileRes.ok)
          throw new Error(`Gmail profile: ${profileRes.status} ${await profileRes.text()}`);
        const profile = (await profileRes.json()) as { emailAddress: string };

        // Baixar metadados e conteúdo dos anexos do Drive em paralelo
        const attachments: Array<{ name: string; mimeType: string; content: Buffer }> = [];
        for (const fileId of drive_file_ids ?? []) {
          const [meta, content] = await Promise.all([
            getDriveFileMeta(fileId),
            getDriveFileContent(fileId),
          ]);
          attachments.push({ name: meta.name, mimeType: meta.mimeType, content });
        }

        // Montar e codificar mensagem MIME
        const rawMime = buildMimeMessage({
          from: profile.emailAddress,
          to: para,
          cc,
          subject: assunto,
          htmlBody: corpo_html,
          attachments,
        });
        const rawEncoded = bufferToBase64Url(Buffer.from(rawMime, 'utf8'));

        // Criar rascunho na API Gmail
        const draftRes = await fetch(`${GMAIL_BASE}/drafts`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ message: { raw: rawEncoded } }),
        });
        if (!draftRes.ok)
          throw new Error(`Gmail draft: ${draftRes.status} ${await draftRes.text()}`);

        const draft = (await draftRes.json()) as {
          id: string;
          message: { id: string; threadId: string };
        };

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  ok: true,
                  draft_id: draft.id,
                  message_id: draft.message?.id,
                  assunto,
                  para,
                  cc: cc ?? [],
                  anexos: attachments.map((a) => a.name),
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (err) {
        return { content: [{ type: 'text', text: String(err) }], isError: true };
      }
    },
  );
}

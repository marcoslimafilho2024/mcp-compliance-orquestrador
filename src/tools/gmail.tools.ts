// src/tools/gmail.tools.ts
// Ferramentas Gmail para o MCP Compliance Orquestrador
// Gmail API REST — credenciais via env GMAIL_ACCESS_TOKEN (escopo gmail.compose)
// Drive API para baixar anexos — env GOOGLE_ACCESS_TOKEN (escopo drive.readonly)

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

const GMAIL_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';
const DRIVE_BASE = 'https://www.googleapis.com/drive/v3';

function gmailToken(): string {
  const token = process.env.GMAIL_ACCESS_TOKEN;
  if (!token) throw new Error('GMAIL_ACCESS_TOKEN é obrigatório (escopo gmail.compose)');
  return token;
}

function driveToken(): string {
  const token = process.env.GOOGLE_ACCESS_TOKEN;
  if (!token) throw new Error('GOOGLE_ACCESS_TOKEN é obrigatório para baixar anexos do Drive');
  return token;
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
  const res = await fetch(`${DRIVE_BASE}/files/${fileId}?fields=name,mimeType`, {
    headers: { Authorization: `Bearer ${driveToken()}` },
  });
  if (!res.ok) throw new Error(`Drive meta ${fileId}: ${res.status} ${await res.text()}`);
  return res.json() as Promise<DriveFileMeta>;
}

async function getDriveFileContent(fileId: string): Promise<Buffer> {
  const res = await fetch(`${DRIVE_BASE}/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${driveToken()}` },
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
        'Requer GMAIL_ACCESS_TOKEN (escopo gmail.compose) e, para anexos, GOOGLE_ACCESS_TOKEN (escopo drive.readonly).',
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
        const token = gmailToken();

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

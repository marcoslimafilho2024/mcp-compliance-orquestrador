import express, { type Request, type Response, type NextFunction } from 'express';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';

const transports: Record<string, SSEServerTransport> = {};

function bearerAuth(req: Request, res: Response, next: NextFunction): void {
  const secret = process.env.MCP_SECRET;
  if (!secret) {
    res.status(503).json({ error: 'MCP_SECRET não configurado no servidor' });
    return;
  }
  const header = req.headers.authorization;
  if (!header || header !== `Bearer ${secret}`) {
    res.status(401).json({ error: 'Token inválido ou ausente' });
    return;
  }
  next();
}

export function startServer(createMcpServer: () => McpServer): void {
  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.get('/sse', bearerAuth, async (req, res) => {
    try {
      const transport = new SSEServerTransport('/messages', res as unknown as ServerResponse);
      transports[transport.sessionId] = transport;

      res.on('close', () => {
        delete transports[transport.sessionId];
      });

      const server = createMcpServer();
      await server.connect(transport);
    } catch (err) {
      if (!res.headersSent) {
        res.status(500).send(err instanceof Error ? err.message : 'Erro ao iniciar SSE');
      }
    }
  });

  app.post('/messages', bearerAuth, async (req, res) => {
    const sessionId = req.query.sessionId;
    if (typeof sessionId !== 'string' || !sessionId) {
      res.status(400).send('sessionId é obrigatório na query');
      return;
    }

    const transport = transports[sessionId];
    if (!transport) {
      res.status(400).send('Sessão SSE não encontrada ou expirada');
      return;
    }

    type PostMessageReq = IncomingMessage & { auth?: AuthInfo };
    await transport.handlePostMessage(
      req as unknown as PostMessageReq,
      res as unknown as ServerResponse,
      req.body,
    );
  });

  const port = Number(process.env.PORT) || 3000;
  const host = '0.0.0.0';
  const httpServer = app.listen(port, host, () => {
    console.log(`MCP ouvindo em http://${host}:${port} (SSE /sse, POST /messages)`);
  });

  const shutdown = async () => {
    for (const id of Object.keys(transports)) {
      try {
        await transports[id]?.close();
      } catch {
        /* ignore */
      }
      delete transports[id];
    }
    httpServer.close(() => process.exit(0));
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

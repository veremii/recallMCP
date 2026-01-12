import express, { Request, Response, NextFunction } from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { validateApiKey } from '../config/auth.js';

const DEFAULT_PORT = 3000;

// Хранилище активных транспортов по session ID
const transports = new Map<string, SSEServerTransport>();

/**
 * Middleware для авторизации по API ключу
 */
function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const apiKey = validateApiKey(authHeader);

  if (!apiKey) {
    res.status(401).json({ error: 'Unauthorized', message: 'Invalid or missing API key' });
    return;
  }

  // Добавляем информацию о пользователе в request
  (req as any).apiKey = apiKey;
  next();
}

/**
 * Создаёт и запускает HTTP сервер с SSE транспортом
 */
export function startHttpServer(mcpServer: Server): void {
  const app = express();
  const port = parseInt(process.env.PORT || String(DEFAULT_PORT), 10);

  // Health check (без авторизации)
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', version: '1.4.0' });
  });

  // SSE endpoint - инициализация соединения
  app.get('/sse', authMiddleware, async (req: Request, res: Response) => {
    console.error(`[SSE] New connection from ${(req as any).apiKey.name}`);

    const transport = new SSEServerTransport('/messages', res);
    const sessionId = transport.sessionId;
    
    transports.set(sessionId, transport);

    res.on('close', () => {
      console.error(`[SSE] Connection closed: ${sessionId}`);
      transports.delete(sessionId);
    });

    await mcpServer.connect(transport);
  });

  // Messages endpoint - получение сообщений от клиента
  // Важно: express.json() должен быть только здесь, чтобы передать body в handlePostMessage
  app.post('/messages', authMiddleware, express.json(), async (req: Request, res: Response) => {
    const sessionId = req.query.sessionId as string;
    
    console.error(`[SSE] Message received for session: ${sessionId}`);
    
    if (!sessionId) {
      res.status(400).json({ error: 'Missing sessionId' });
      return;
    }

    const transport = transports.get(sessionId);
    
    if (!transport) {
      console.error(`[SSE] Session not found: ${sessionId}`);
      console.error(`[SSE] Active sessions: ${Array.from(transports.keys()).join(', ')}`);
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    try {
      // Передаём уже распарсенный body как третий аргумент
      await transport.handlePostMessage(req, res, req.body);
    } catch (error) {
      console.error('[SSE] Message handling error:', error);
      // Не отправляем ответ если handlePostMessage уже отправил
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  });

  // 404 handler
  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  app.listen(port, '0.0.0.0', () => {
    console.error(`[HTTP] Server listening on http://0.0.0.0:${port}`);
    console.error(`[HTTP] SSE endpoint: http://localhost:${port}/sse`);
  });
}

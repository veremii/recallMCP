#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';

import { connectDatabase, disconnectDatabase } from './config/database.js';
import { initVectorStore } from './services/vectorStore.js';
import { preloadModel } from './services/embeddings.js';
import { syncMongoToQdrant } from './services/sync.js';
import { saveKnowledge, SaveKnowledgeInputSchema } from './tools/saveKnowledge.js';
import { searchKnowledge, SearchKnowledgeInputSchema } from './tools/searchKnowledge.js';
import { getKnowledge, GetKnowledgeInputSchema } from './tools/getKnowledge.js';

const SERVER_NAME = 'recall-mcp';
const SERVER_VERSION = '1.3.0';

/**
 * Создание и настройка MCP сервера
 */
function createServer(): Server {
  const server = new Server(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {} } }
  );

  // Регистрация списка доступных инструментов
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'save_knowledge',
        description: 'Сохраняет сниппет кода, решение проблемы или паттерн в базу знаний (с векторизацией)',
        inputSchema: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Краткое название' },
            content: { type: 'string', description: 'Полное содержимое: код или описание' },
            kind: { type: 'string', enum: ['snippet', 'issue', 'pattern'], description: 'Тип записи' },
            tags: { type: 'array', items: { type: 'string' }, description: 'Теги для поиска' },
            project: { type: 'string', description: 'Название проекта (опционально)' },
          },
          required: ['title', 'content', 'kind', 'tags'],
        },
      },
      {
        name: 'search_knowledge',
        description: 'Семантический поиск по базе знаний. Находит похожие по смыслу записи',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Поисковый запрос (natural language)' },
            kind: { type: 'string', enum: ['snippet', 'issue', 'pattern'], description: 'Фильтр по типу' },
            project: { type: 'string', description: 'Фильтр по проекту' },
            limit: { type: 'number', description: 'Количество результатов (1-20, по умолчанию 5)' },
          },
          required: ['query'],
        },
      },
      {
        name: 'get_knowledge',
        description: 'Получает полное содержимое записи по ID из результатов поиска',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'ID записи' },
          },
          required: ['id'],
        },
      },
    ],
  }));

  // Обработка вызовов инструментов
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      let result: string;

      switch (name) {
        case 'save_knowledge': {
          const parsed = SaveKnowledgeInputSchema.parse(args);
          result = await saveKnowledge(parsed);
          break;
        }
        case 'search_knowledge': {
          const parsed = SearchKnowledgeInputSchema.parse(args);
          result = await searchKnowledge(parsed);
          break;
        }
        case 'get_knowledge': {
          const parsed = GetKnowledgeInputSchema.parse(args);
          result = await getKnowledge(parsed);
          break;
        }
        default:
          throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
      }

      return { content: [{ type: 'text', text: result }] };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[Tool Error] ${name}:`, message);
      
      throw new McpError(ErrorCode.InternalError, `Tool "${name}" failed: ${message}`);
    }
  });

  return server;
}

/**
 * Точка входа
 */
async function main(): Promise<void> {
  console.error(`[${SERVER_NAME}] Starting v${SERVER_VERSION}...`);

  // 1. Подключение к MongoDB (обязательно)
  try {
    await connectDatabase();
  } catch (error) {
    console.error('[Fatal] Cannot start without database:', error);
    process.exit(1);
  }

  // 2. Инициализация Qdrant (обязательно для векторного поиска)
  try {
    await initVectorStore();
  } catch (error) {
    console.error('[Fatal] Cannot start without Qdrant:', error);
    process.exit(1);
  }

  // 3. Загрузка embedding модели (обязательно, блокирующая)
  try {
    console.error('[Startup] Loading embedding model (this may take a minute)...');
    await preloadModel();
    console.error('[Startup] Embedding model ready');
  } catch (error) {
    console.error('[Fatal] Cannot start without embedding model:', error);
    process.exit(1);
  }

  // 4. Синхронизация MongoDB → Qdrant (индексируем записи без векторов)
  try {
    await syncMongoToQdrant();
  } catch (error) {
    console.error('[Warning] Sync failed:', error);
    // Не fatal — сервер может работать, но часть записей без векторов
  }

  // 5. Создание и запуск MCP сервера
  const server = createServer();
  const transport = new StdioServerTransport();

  // Graceful shutdown
  const shutdown = async () => {
    console.error(`[${SERVER_NAME}] Shutting down...`);
    await disconnectDatabase();
    await server.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  await server.connect(transport);
  console.error(`[${SERVER_NAME}] Server running on stdio`);
}

main().catch((error) => {
  console.error('[Fatal]', error);
  process.exit(1);
});

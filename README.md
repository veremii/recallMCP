# Recall MCP

MCP-сервер для персистентного хранения инженерных знаний с **семантическим поиском**.

## Архитектура

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Claude    │────▶│  MCP Server │────▶│   MongoDB   │  (метаданные)
└─────────────┘     └──────┬──────┘     └─────────────┘
                          │
                          ▼
                   ┌─────────────┐     ┌─────────────┐
                   │   Ollama    │────▶│   Qdrant    │  (векторы)
                   │ (embeddings)│     │ (quantized) │
                   └─────────────┘     └─────────────┘
```

**Всё в Docker — запуск в 1 клик.**

## Быстрый старт

### 1. Запуск (один клик)

```bash
./scripts/start.sh
```

Или напрямую:

```bash
docker-compose up -d
```

Автоматически поднимутся:

- **MongoDB** — хранение метаданных
- **Qdrant** — векторное хранилище (quantized)
- **Ollama** — локальные эмбеддинги
- **MCP Server** — сам сервер

Модель `nomic-embed-text` скачается автоматически при первом запуске.

### 2. Настройка Claude Desktop

`~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "recall": {
      "command": "docker",
      "args": ["exec", "-i", "recall-mcp", "node", "dist/index.js"]
    }
  }
}
```

### 3. Остановка

```bash
./scripts/stop.sh
```

## Инструменты

### `save_knowledge`

Сохраняет знание с автоматической векторизацией.

### `search_knowledge`

**Семантический поиск** — находит по смыслу, не только по ключевым словам.

```
Запрос: "настройка бандлера для микросервисов"
Найдёт: "Webpack конфиг для микро-фронтендов"
```

### `get_knowledge`

Получает полное содержимое по ID.

## Оптимизации

| Техника                 | Описание                      | Эффект           |
| ----------------------- | ----------------------------- | ---------------- |
| **Scalar Quantization** | int8 вместо float32           | 4x меньше памяти |
| **HNSW Index**          | Approximate nearest neighbors | O(log n) поиск   |
| **Hybrid Search**       | Vector → Text fallback        | 100% coverage    |

## Разработка (без Docker)

```bash
npm install

# Поднять только БД
docker-compose up -d mongodb qdrant ollama

# Dev режим
npm run dev
```

## Переменные окружения

| Переменная        | По умолчанию                           | Описание               |
| ----------------- | -------------------------------------- | ---------------------- |
| `MONGODB_URI`     | `mongodb://localhost:27017/recall_mcp` | MongoDB                |
| `QDRANT_URL`      | `http://localhost:6333`                | Qdrant vector DB       |
| `OLLAMA_URL`      | `http://localhost:11434`               | Ollama API             |
| `EMBEDDING_MODEL` | `nomic-embed-text`                     | Модель для эмбеддингов |

## Требования

- Docker & Docker Compose
- ~4GB RAM (Ollama + модель)
- ~2GB диска (модель + данные)

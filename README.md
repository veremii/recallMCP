# Recall MCP

MCP-сервер для персистентного хранения инженерных знаний с **семантическим поиском**.

## Архитектура

```
┌─────────────┐     ┌───────────────────────────────┐
│   Claude    │────▶│         MCP Server            │
└─────────────┘     │  ┌─────────────────────────┐  │
                    │  │  transformers.js        │  │──▶ Qdrant
                    │  │  (multilingual-e5-small)│  │    (vectors)
                    │  └─────────────────────────┘  │
                    └───────────────┬───────────────┘
                                    │
                                    ▼
                              ┌───────────┐
                              │  MongoDB  │
                              │  (data)   │
                              └───────────┘
```

**Всё в Docker — запуск в 1 клик. Без Ollama (~500MB вместо ~3GB).**

## Быстрый старт

### 1. Запуск

```bash
docker-compose up -d
```

Автоматически поднимутся:

- **MongoDB** — хранение данных
- **Qdrant** — векторное хранилище (quantized)
- **MCP Server** — сервер с встроенными эмбеддингами

Модель `multilingual-e5-small` (~90MB) скачается при первом запуске.

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
docker-compose down
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

| Техника                 | Описание                       | Эффект           |
| ----------------------- | ------------------------------ | ---------------- |
| **Scalar Quantization** | int8 вместо float32            | 4x меньше памяти |
| **ONNX Runtime**        | transformers.js с квантованием | ~90MB модель     |
| **Hybrid Search**       | Vector → Text fallback         | 100% coverage    |

## Модель эмбеддингов

**multilingual-e5-small** — мультиязычная модель с хорошей поддержкой русского.

- Размер: ~90MB (quantized)
- Dimensions: 384
- Качество на русском: ~58% MTEB

## Разработка (без Docker)

```bash
npm install

# Поднять только БД
docker-compose up -d mongodb qdrant

# Dev режим
npm run dev
```

## Переменные окружения

| Переменная    | По умолчанию                           | Описание         |
| ------------- | -------------------------------------- | ---------------- |
| `MONGODB_URI` | `mongodb://localhost:27017/recall_mcp` | MongoDB          |
| `QDRANT_URL`  | `http://localhost:6333`                | Qdrant vector DB |

## Требования

- Docker & Docker Compose
- ~1GB RAM
- ~500MB диска

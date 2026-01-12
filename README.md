# Recall MCP

MCP server for persistent engineering knowledge storage with **semantic search**.

## Architecture

```
┌─────────────┐     ┌───────────────────────────────┐
│ Claude/     │────▶│         MCP Server            │
│ Cursor      │ SSE │  ┌─────────────────────────┐  │──▶ Qdrant
└─────────────┘     │  │  transformers.js        │  │    (vectors)
                    │  │  (multilingual-e5-small)│  │
                    │  └─────────────────────────┘  │
                    └───────────────┬───────────────┘
                                    │
                                    ▼
                              ┌───────────┐
                              │  MongoDB  │
                              │  (data)   │
                              └───────────┘
```

**All in Docker — one-click start. No Ollama (~500MB instead of ~3GB).**

## Quick Start

### Option 1: HTTP Mode (Recommended for SaaS)

```bash
# Create API keys config
cp config/api-keys.example.json config/api-keys.json
# Edit api-keys.json with your keys

# Start
docker-compose up -d
```

Server will be available at `http://localhost:3000`

**Configure client:**

```json
{
  "mcpServers": {
    "recall": {
      "url": "http://localhost:3000/sse",
      "headers": {
        "Authorization": "Bearer sk-recall-xxxxxxxxxxxxxxxxxxxx"
      }
    }
  }
}
```

### Option 2: stdio Mode (Local Development)

```bash
docker-compose -f docker-compose.stdio.yml up -d
```

**Configure Claude Desktop:**

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

### Stop

```bash
docker-compose down
```

## Transport Modes

| Mode    | Use Case              | Auth    | Config            |
| ------- | --------------------- | ------- | ----------------- |
| `http`  | SaaS, remote access   | API Key | `TRANSPORT=http`  |
| `stdio` | Local, Claude Desktop | None    | `TRANSPORT=stdio` |

## API Authentication

Create `config/api-keys.json`:

```json
{
  "keys": [
    {
      "id": "user-1",
      "key": "sk-recall-your-secret-key",
      "name": "My API Key",
      "enabled": true
    }
  ]
}
```

Use in requests:

```
Authorization: Bearer sk-recall-your-secret-key
```

## Endpoints (HTTP Mode)

| Endpoint    | Method | Auth    | Description    |
| ----------- | ------ | ------- | -------------- |
| `/health`   | GET    | No      | Health check   |
| `/sse`      | GET    | API Key | SSE connection |
| `/messages` | POST   | API Key | MCP messages   |

## Tools

### `save_knowledge`

Saves knowledge with automatic vectorization.

**Arguments:**

- `title` (string) — short title
- `content` (string) — full content (code, config, description)
- `kind` (enum) — `snippet` | `issue` | `pattern`
- `tags` (string[]) — tags for search
- `project` (string, optional) — project name

### `search_knowledge`

**Semantic search** — finds by meaning, not just keywords.

**Arguments:**

- `query` (string) — search query (natural language)
- `kind` (enum, optional) — filter by type
- `project` (string, optional) — filter by project
- `limit` (number, optional) — results count (1-20, default 5)

```
Query: "how to configure bundler for microservices"
Finds: "Webpack config for micro-frontends"
```

### `get_knowledge`

Gets full content by ID from search results.

**Arguments:**

- `id` (string) — record ID

## Features

| Feature                 | Description                       | Effect         |
| ----------------------- | --------------------------------- | -------------- |
| **Scalar Quantization** | int8 instead of float32           | 4x less memory |
| **ONNX Runtime**        | transformers.js with quantization | ~90MB model    |
| **Hybrid Search**       | Vector → Text fallback            | 100% coverage  |
| **Auto Sync**           | MongoDB ↔ Qdrant sync on start    | No data loss   |
| **SSE Transport**       | HTTP-based, no Docker commands    | Easy deploy    |

## Environment Variables

| Variable        | Default                                | Description           |
| --------------- | -------------------------------------- | --------------------- |
| `MONGODB_URI`   | `mongodb://localhost:27017/recall_mcp` | MongoDB               |
| `QDRANT_URL`    | `http://localhost:6333`                | Qdrant vector DB      |
| `TRANSPORT`     | `stdio`                                | `http` or `stdio`     |
| `PORT`          | `3000`                                 | HTTP port             |
| `API_KEYS_PATH` | `./config/api-keys.json`               | Path to API keys file |

## Development

```bash
npm install

# Start only databases
docker-compose up -d mongodb qdrant

# Dev mode (stdio)
npm run dev

# Dev mode (http)
TRANSPORT=http PORT=3000 npm run dev
```

## Requirements

- Docker & Docker Compose
- ~1GB RAM
- ~500MB disk space

## License

MIT

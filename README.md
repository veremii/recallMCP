# Recall MCP

MCP server for persistent engineering knowledge storage with **semantic search**.

## Architecture

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

**All in Docker — one-click start. No Ollama (~500MB instead of ~3GB).**

## Quick Start

### 1. Run

```bash
docker-compose up -d
```

This will automatically start:

- **MongoDB** — data storage
- **Qdrant** — vector store (quantized)
- **MCP Server** — server with built-in embeddings

The `multilingual-e5-small` model (~90MB) will be downloaded on first run.

### 2. Configure Claude Desktop

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

For Cursor IDE, add to `~/.cursor/mcp.json`.

### 3. Stop

```bash
docker-compose down
```

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

## Embedding Model

**multilingual-e5-small** — multilingual model with good Russian support.

- Size: ~90MB (quantized)
- Dimensions: 384
- Quality: ~58% MTEB

## Development (without Docker)

```bash
npm install

# Start only databases
docker-compose up -d mongodb qdrant

# Dev mode
npm run dev
```

## Environment Variables

| Variable      | Default                                | Description      |
| ------------- | -------------------------------------- | ---------------- |
| `MONGODB_URI` | `mongodb://localhost:27017/recall_mcp` | MongoDB          |
| `QDRANT_URL`  | `http://localhost:6333`                | Qdrant vector DB |

## Requirements

- Docker & Docker Compose
- ~1GB RAM
- ~500MB disk space

## License

MIT

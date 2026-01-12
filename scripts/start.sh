#!/bin/bash
set -e

echo "🚀 Starting Recall MCP..."

# Запуск всех сервисов
docker-compose up -d

# Ждём инициализации модели
echo "⏳ Waiting for Ollama model to download..."
docker-compose logs -f ollama-init 2>/dev/null || true

echo ""
echo "✅ Recall MCP is ready!"
echo ""
echo "Services:"
echo "  - MongoDB:    localhost:27017"
echo "  - Qdrant:     localhost:6333"
echo "  - Ollama:     localhost:11434"
echo "  - MCP Server: recall-mcp (stdio)"
echo ""
echo "Add to Claude Desktop config:"
echo '  "recall": {'
echo '    "command": "docker",'
echo '    "args": ["exec", "-i", "recall-mcp", "node", "dist/index.js"]'
echo '  }'

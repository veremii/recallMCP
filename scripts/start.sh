#!/bin/bash
set -e

echo "🚀 Starting Recall MCP..."

# Запуск всех сервисов
docker-compose up -d

echo ""
echo "✅ Recall MCP is starting!"
echo ""
echo "Services:"
echo "  - MongoDB: localhost:27017"
echo "  - Qdrant:  localhost:6333"
echo "  - MCP:     recall-mcp (stdio)"
echo ""
echo "First run will download the embedding model (~90MB)."
echo ""
echo "Add to Claude Desktop config:"
echo '  "recall": {'
echo '    "command": "docker",'
echo '    "args": ["exec", "-i", "recall-mcp", "node", "dist/index.js"]'
echo '  }'

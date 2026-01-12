FROM node:20-slim AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source
COPY tsconfig.json ./
COPY src ./src

# Build
RUN npm run build

# Production stage
FROM node:20-slim AS production

WORKDIR /app

# Create cache directory BEFORE switching to node user
RUN mkdir -p /app/.cache && chown -R node:node /app

# Copy package files and install production deps
COPY --chown=node:node package*.json ./

# Switch to node user for npm install
USER node
RUN npm ci --omit=dev

# Copy built files
COPY --from=builder --chown=node:node /app/dist ./dist

# Set cache paths
ENV TRANSFORMERS_CACHE=/app/.cache
ENV HF_HOME=/app/.cache
ENV XDG_CACHE_HOME=/app/.cache

CMD ["node", "dist/index.js"]

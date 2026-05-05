FROM node:20-slim

# Install Chromium and required system libraries
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-noto \
    fonts-noto-color-emoji \
    ca-certificates \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

ENV CHROMIUM_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Install pnpm
RUN npm install -g pnpm@9

WORKDIR /app

# Copy workspace config files first (for better layer caching)
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY tsconfig.base.json tsconfig.json ./

# Copy all packages
COPY lib/ ./lib/
COPY artifacts/api-server/ ./artifacts/api-server/
COPY artifacts/whatsapp-monitor/ ./artifacts/whatsapp-monitor/
COPY scripts/ ./scripts/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Run codegen (generates client hooks + zod schemas)
RUN pnpm --filter @workspace/api-spec run codegen

# Build frontend
RUN pnpm --filter @workspace/whatsapp-monitor run build

# Build API server
RUN pnpm --filter @workspace/api-server run build

# Copy built frontend into API server's public directory so it can be served
RUN mkdir -p /app/artifacts/api-server/public \
    && cp -r /app/artifacts/whatsapp-monitor/dist/. /app/artifacts/api-server/public/

EXPOSE 8080
ENV PORT=8080
ENV NODE_ENV=production

WORKDIR /app/artifacts/api-server
CMD ["node", "--enable-source-maps", "./dist/index.mjs"]

# ====================================================================
# INNOICA WhatsApp Agents v2.0 — Ingestion Worker Dockerfile
# ====================================================================

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@11.25.0 --activate

WORKDIR /app

# Copy dependency manifests
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/database/package.json ./packages/database/
COPY services/ingestion-worker/package.json ./services/ingestion-worker/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/shared ./packages/shared
COPY packages/database ./packages/database
COPY services/ingestion-worker ./services/ingestion-worker

ENV NODE_ENV=production
ENV PORT=4003

EXPOSE 4003

WORKDIR /app/services/ingestion-worker
CMD ["pnpm", "start"]

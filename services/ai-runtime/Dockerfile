# ====================================================================
# INNOICA WhatsApp Agents v2.0 — AI Runtime Service Dockerfile
# ====================================================================

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@11.25.0 --activate

WORKDIR /app

# Copy dependency manifests
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/database/package.json ./packages/database/
COPY services/ai-runtime/package.json ./services/ai-runtime/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/shared ./packages/shared
COPY packages/database ./packages/database
COPY services/ai-runtime ./services/ai-runtime

ENV NODE_ENV=production
ENV PORT=4002

EXPOSE 4002

WORKDIR /app/services/ai-runtime
CMD ["pnpm", "start"]

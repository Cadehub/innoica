# ====================================================================
# INNOICA WhatsApp Agents v2.0 — WhatsApp Worker (Baileys) Dockerfile
# ====================================================================

FROM node:22-alpine AS base
RUN apk add --no-cache python3 make g++ git
RUN corepack enable && corepack prepare pnpm@11.25.0 --activate

WORKDIR /app

# Copy dependency manifests
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/database/package.json ./packages/database/
COPY services/whatsapp-worker/package.json ./services/whatsapp-worker/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/shared ./packages/shared
COPY packages/database ./packages/database
COPY services/whatsapp-worker ./services/whatsapp-worker

ENV NODE_ENV=production
ENV PORT=4001
ENV SESSIONS_DIR=/app/sessions

# Ensure sessions volume directory exists
RUN mkdir -p /app/sessions

EXPOSE 4001

WORKDIR /app/services/whatsapp-worker
CMD ["pnpm", "start"]

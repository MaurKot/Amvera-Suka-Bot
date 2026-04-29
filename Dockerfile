# syntax=docker/dockerfile:1.6
# ---------- Builder ----------
FROM node:22-alpine AS builder

ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /repo

# Install dependencies (cached layer)
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY artifacts ./artifacts
COPY lib ./lib
COPY tooling ./tooling
COPY tsconfig*.json ./

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# Build frontend (vite expects PORT and BASE_PATH at config-eval time)
ENV PORT=8080
ENV BASE_PATH=/
ENV NODE_ENV=production
RUN pnpm --filter @workspace/altera run build

# Build API server (esbuild bundle)
RUN pnpm --filter @workspace/api-server run build

# ---------- Runtime ----------
FROM node:22-alpine AS runtime

WORKDIR /app

# Bundled API server (esbuild produced ESM)
COPY --from=builder /repo/artifacts/api-server/dist ./dist

# Built static frontend served by the API at "/"
COPY --from=builder /repo/artifacts/altera/dist ./public

# Drizzle migration metadata (optional, for runtime push if ever needed)
COPY --from=builder /repo/lib/db ./db-meta

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

# Healthcheck against the API
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q -O - "http://127.0.0.1:${PORT}/api/lore" >/dev/null || exit 1

CMD ["node", "--enable-source-maps", "dist/index.mjs"]

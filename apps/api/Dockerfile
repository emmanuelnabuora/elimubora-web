# Multi-stage build using Turborepo's prune pattern, verified against
# this actual monorepo (see: npx turbo prune @elimubora/api --docker).
# Build from the REPO ROOT, not this directory:
#   docker build -f apps/api/Dockerfile -t elimubora-api .

FROM node:20-slim AS base

# ---- Stage 1: prune the monorepo down to just this app + its deps ----
FROM base AS pruner
WORKDIR /app
RUN npm install -g turbo@^2
COPY . .
RUN turbo prune @elimubora/api --docker

# ---- Stage 2: install dependencies (cacheable — only package.json files) ----
FROM base AS installer
WORKDIR /app
COPY --from=pruner /app/out/json/ .
RUN npm ci

# ---- Stage 3: build the real source ----
FROM base AS builder
WORKDIR /app
COPY --from=installer /app/ .
COPY --from=pruner /app/out/full/ .
# turbo prune's output never includes root-level files that live
# outside any single workspace directory — but every workspace's
# tsconfig.json extends this one via a relative "../../" path, so the
# build fails with TS5083 (cannot read tsconfig.base.json) without it.
# Confirmed by actually running the build and reading the real error,
# not guessed.
COPY --from=pruner /app/tsconfig.base.json .
# tools/ (migrate.mjs, rotate-secrets.mjs) isn't part of any workspace,
# so turbo prune never includes it either — same root cause as
# tsconfig.base.json above. Needed here because this same image is
# reused to run migrations/secret-rotation as one-off Cloud Run Jobs,
# not just to serve the API. No new dependency required: migrate.mjs
# only imports 'pg', which apps/api already depends on directly.
COPY --from=pruner /app/tools ./tools
RUN npx turbo run build --filter=@elimubora/api...
# Drop devDependencies (typescript, jest, ts-node, ...) before shipping —
# nothing past this point needs them, only the compiled dist/ output.
RUN npm prune --omit=dev

# ---- Stage 4: minimal runtime image ----
FROM base AS runner
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 elimubora
COPY --from=builder --chown=elimubora:nodejs /app .
USER elimubora

# Cloud Run injects its own PORT at runtime and expects the container to
# listen on it — this default only matters for local `docker run` testing.
ENV PORT=4000
EXPOSE 4000

CMD ["node", "apps/api/dist/main.js"]

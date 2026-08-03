# Multi-stage build using Turborepo's prune pattern.
# Build from the REPO ROOT, not this directory, and note the required
# build arg (see the comment on NEXT_PUBLIC_API_URL below):
#   docker build -f apps/web/Dockerfile \
#     --build-arg NEXT_PUBLIC_API_URL=https://your-api-url \
#     -t elimubora-web .

FROM node:20-slim AS base

FROM base AS pruner
WORKDIR /app
RUN npm install -g turbo@^2
COPY . .
RUN turbo prune @elimubora/web --docker

FROM base AS installer
WORKDIR /app
COPY --from=pruner /app/out/json/ .
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=installer /app/ .
COPY --from=pruner /app/out/full/ .
# See apps/api/Dockerfile for why this line is needed — turbo prune
# never includes root-level files outside any single workspace, but
# every workspace's tsconfig.json extends this one.
COPY --from=pruner /app/tsconfig.base.json .

# IMPORTANT Next.js detail, easy to get wrong: NEXT_PUBLIC_* variables
# are inlined into the client-side JavaScript bundle at BUILD time, not
# read at runtime like the API's secrets are. Setting NEXT_PUBLIC_API_URL
# as a Cloud Run *runtime* env var alone would do nothing — the browser
# bundle would still contain whatever value (or lack of one) was present
# when this RUN command executed. It must be passed as a --build-arg.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npx turbo run build --filter=@elimubora/web...
RUN npm prune --omit=dev

FROM base AS runner
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 elimubora
COPY --from=builder --chown=elimubora:nodejs /app .
USER elimubora

ENV PORT=3000
EXPOSE 3000

# `next start --prefix` is not a valid flag (confirmed the hard way
# earlier in this project) — cd into the app directory instead, where
# .next lives; node_modules still resolves via Node's normal up-the-tree
# lookup to the hoisted workspace root.
WORKDIR /app/apps/web
CMD ["npx", "next", "start", "-p", "3000"]

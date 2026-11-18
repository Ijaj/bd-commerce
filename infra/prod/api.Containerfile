# syntax=docker/dockerfile:1
# bdc-api: NestJS API + Prisma migrations. Build from the repo root:
#   podman build -f infra/prod/api.Containerfile -t localhost/bdc-api:latest .
ARG NODE_IMAGE=docker.io/library/node:24-bookworm-slim

FROM ${NODE_IMAGE} AS base
ENV PNPM_HOME=/pnpm \
    npm_config_store_dir=/pnpm/store \
    CI=true
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /repo

# Layer 1: fetch deps from the lockfile only (cached until the lockfile changes).
FROM base AS fetch
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,target=/pnpm/store pnpm fetch

FROM fetch AS build
COPY . .
RUN --mount=type=cache,target=/pnpm/store \
    pnpm install --offline --frozen-lockfile --filter "@bdc/api..."
RUN pnpm --filter @bdc/api prisma:generate \
 && pnpm --filter @bdc/api build
# (prisma CLI for `migrate deploy` at start comes in as a peer dep of @prisma/client; see runtime stage)
RUN --mount=type=cache,target=/pnpm/store \
    pnpm --filter @bdc/api deploy --prod --legacy /out \
 && cp -r apps/api/dist /out/dist \
 && cp -r apps/api/prisma /out/prisma \
 && cp apps/api/prisma.config.ts /out/prisma.config.ts

FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4000
# openssl: Prisma's schema engine (migrate deploy) detects it; ca-certificates: courier/SMTP TLS.
USER root
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build --chown=node:node /out/ ./
# prisma is only a transitive dep of @prisma/client in the pruned tree: expose it at the top level so
# prisma.config.ts can import "prisma/config" and the entrypoint can run `migrate deploy`.
RUN ln -s "$(ls -d /app/node_modules/.pnpm/prisma@7.10.1*/node_modules/prisma | head -1)" /app/node_modules/prisma
COPY --chown=node:node infra/prod/entrypoint-api.sh /usr/local/bin/entrypoint-api.sh
RUN chmod +x /usr/local/bin/entrypoint-api.sh
USER node
EXPOSE 4000
ENTRYPOINT ["/usr/local/bin/entrypoint-api.sh"]

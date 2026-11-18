# syntax=docker/dockerfile:1
# bdc-shop: Next.js storefront (standalone output). Build from the repo root:
#   podman build -f infra/prod/shop.Containerfile -t localhost/bdc-shop:latest \
#     --build-arg API_URL=http://api:4000 --build-arg SITE_URL=https://example.com .
# API_URL is baked into next.config.ts rewrites at build time; API_URL and SITE_URL are also read at runtime
# (server-side fetches), so the runtime image carries the same values (override with -e if needed).
ARG NODE_IMAGE=docker.io/library/node:24-bookworm-slim

FROM ${NODE_IMAGE} AS base
ENV PNPM_HOME=/pnpm \
    npm_config_store_dir=/pnpm/store \
    CI=true
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /repo

FROM base AS fetch
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,target=/pnpm/store pnpm fetch

FROM fetch AS build
ARG API_URL=http://api:4000
ARG SITE_URL=http://localhost:3100
ENV API_URL=${API_URL} \
    SITE_URL=${SITE_URL} \
    NEXT_OUTPUT=standalone \
    NEXT_TELEMETRY_DISABLED=1
COPY . .
RUN --mount=type=cache,target=/pnpm/store \
    pnpm install --offline --frozen-lockfile --filter "@bdc/shop..."
# i18n ships a built dist; api-client ships TS source (transpilePackages).
RUN pnpm --filter @bdc/i18n build \
 && pnpm --filter @bdc/shop build

FROM ${NODE_IMAGE} AS runtime
ARG API_URL=http://api:4000
ARG SITE_URL=http://localhost:3100
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3100 \
    API_URL=${API_URL} \
    SITE_URL=${SITE_URL}
WORKDIR /app
COPY --from=build --chown=node:node /repo/apps/shop/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/shop/.next/static ./apps/shop/.next/static
COPY --from=build --chown=node:node /repo/apps/shop/public ./apps/shop/public
USER node
EXPOSE 3100
WORKDIR /app/apps/shop
CMD ["node", "server.js"]

# syntax=docker/dockerfile:1
# bdc-web: Caddy + the admin and portal SPAs. The Caddyfile is mounted by compose, not baked in.
#   podman build -f infra/prod/web.Containerfile -t localhost/bdc-web:latest --build-arg SITE_URL=https://example.com .
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
ARG SITE_URL=http://localhost:3100
# Admin bakes VITE_SITE_URL from SITE_URL ("View store" link).
ENV SITE_URL=${SITE_URL}
COPY . .
RUN --mount=type=cache,target=/pnpm/store \
    pnpm install --offline --frozen-lockfile --filter "@bdc/admin..." --filter "@bdc/portal..."
RUN pnpm --filter @bdc/ui build \
 && pnpm --filter @bdc/i18n build \
 && pnpm --filter @bdc/admin build \
 && pnpm --filter @bdc/portal build

FROM docker.io/library/caddy:2
COPY --from=build /repo/apps/admin/dist /srv/admin
COPY --from=build /repo/apps/portal/dist /srv/portal

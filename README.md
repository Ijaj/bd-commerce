# bd-commerce

General-purpose e-commerce for Bangladesh. Planning docs live in [`plan/`](plan/README.md); decisions in [`plan/10-decisions-log.md`](plan/10-decisions-log.md).

## Requirements

- Node.js 24 (`.nvmrc`), pnpm 11 (`corepack enable`)
- Podman with `podman compose`

## Local dev

```sh
pnpm install
cp .env.example .env
pnpm stack:up      # Postgres 18, Redis 8, Garage (S3), imgproxy
pnpm stack:init    # first run only: Garage layout, dev key, buckets
```

| Service  | Address          | Notes                         |
| -------- | ---------------- | ----------------------------- |
| Postgres | `localhost:5432` | dbs `bdc`, `bdc_test`         |
| Redis    | `localhost:6379` | AOF on                        |
| Garage   | `localhost:3900` | S3 API, region `garage`       |
| imgproxy | `localhost:8080` | signed URLs, reads `s3://...` |

`pnpm stack:down` stops it; `pnpm stack:reset` also deletes the data volumes.

## Scripts

`pnpm check` (Biome lint + format), `pnpm fix`, `pnpm typecheck`, `pnpm test`, `pnpm build`.

## API

`apps/api`: NestJS 11 + Prisma 7, compiled with SWC (TypeScript 7 type-check). `pnpm --filter @bdc/api dev` serves on `:4000`: `/health`, routes under `/v1`, Swagger UI at `/docs` (non-production).

After changing API routes or schemas run `pnpm api:gen`. It rewrites `packages/api-client/openapi.json` and the generated types; CI fails if they are stale.

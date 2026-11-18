# Step 9a brief: self-hosted test deployment (C92–C95)

Goal: one owner PC runs the whole platform with Podman Compose behind a Cloudflare Tunnel,
`APP_STAGE=staging` (C94: production build + checks, SMS texts go to a private Mailpit). No domain yet
(C95): everything keys off `BASE_DOMAIN`; local test uses `BASE_DOMAIN=bdc.localhost` + `PUBLIC_SCHEME=http`
(`*.localhost` resolves to 127.0.0.1 in browsers and curl).

## Facts (verified by lead, don't re-derive)

- Monorepo pnpm + turbo, Node 24 (root `package.json` has `packageManager`; pnpm 11 enforces
  `allowBuilds` / min release age in `pnpm-workspace.yaml`). TypeScript 7 for most packages, 6.0.3 for
  `packages/api-client`.
- API `apps/api`: build `pnpm --filter @bdc/api build` (swc → `dist/`, needs `prisma generate` first:
  turbo task `prisma:generate`, client in `src/generated`). Start `node --enable-source-maps dist/main.js`,
  CLI `node --enable-source-maps dist/cli.js <cmd>` (commands in `apps/api/src/cli.ts`). Migrations:
  `prisma migrate deploy` (prisma CLI is a devDependency, `prisma.config.ts`). Uses `sharp` (needs glibc → use
  `docker.io/library/node:24-bookworm-slim`, not alpine). Env schema: `apps/api/src/config/env.ts`
  (read it). Production listens on 127.0.0.1 unless `HOST` is set → set `HOST=0.0.0.0` in the container.
  Cookies are `secure` when NODE_ENV=production.
- Shop `apps/shop` Next.js 16: `API_URL` (server-side + rewrites in `next.config.ts`, **rewrites are baked at
  build** → build arg `API_URL=http://api:4000`), `SITE_URL` (`src/lib/env.ts`, used in metadata/sitemap,
  pass as build arg and runtime env). Port 3100. Check whether `next build` calls the API (generateStaticParams
  / ISR in `src/app/[lang]/**`); the image build must NOT need a running API (tolerate fetch failure or make
  that page dynamic; tell lead what you changed).
- Admin `apps/admin` + portal `apps/portal`: Vite SPAs, `vite build` → `dist/`. They call the API
  **same-origin** at `/v1/*` (dev uses a vite proxy) → production web server must proxy `/v1/*` to the API on
  those hosts. Admin bakes `VITE_SITE_URL` from env `SITE_URL` at build (see `apps/admin/vite.config.ts`).
  SPA fallback to `index.html`.
- Dev stack for reference: `infra/dev/compose.yaml`, `infra/dev/garage.toml`, `infra/dev/garage-init.sh`,
  `dev.sh`. Images: postgres:18-alpine, redis:8-alpine, dxflrs/garage:v2.4.1, darthsim/imgproxy:v3.31.4,
  axllent/mailpit:v1.32.0. Always write fully qualified `docker.io/...` names (Podman).
- **This machine: `podman exec` is broken** (rootless podman 6.2 + crun 1.31: "write to
  /proc/self/oom_score_adj: Permission denied"). Use the sidecar fallback from `dev.sh` (`ctr_exec`):
  `podman run --rm --network container:<c> --volumes-from <c> <image> <cmd>`. Scripts must try exec first, then
  fall back.
- Dev stack may be running (project `bdc-dev`, host ports 5432/6379/3900/8080/1025/8025, API :4000, shop
  :3100, admin :5173, portal :5190). Prod stack must not collide: project name `bdc-prod`, no host ports except
  Caddy on `127.0.0.1:${HTTP_PORT:-8088}`.

## Contracts (fixed; both agents rely on them)

- Files in `infra/prod/`. Build context = repo root. Root `.containerignore` (node_modules, **/.next,
  **/dist, **/.turbo, e2e/test-results, e2e/playwright-report, .env, .env.*, !.env.example, .git).
- Images (tag exactly):
  - `localhost/bdc-api:latest` ← `infra/prod/api.Containerfile`. Entrypoint: `prisma migrate deploy` then
    start the API. Also usable for CLI: `podman run ... localhost/bdc-api:latest cli <cmd> [args]` (entrypoint
    script dispatches `cli` → `node dist/cli.js`, `migrate` → migrate only, default → migrate + start).
    Runs as non-root.
  - `localhost/bdc-shop:latest` ← `infra/prod/shop.Containerfile` (Next `output: 'standalone'`, enabled only
    when env `NEXT_OUTPUT=standalone` so `next start`/dev stay unchanged). Build args `API_URL`, `SITE_URL`.
    Listens 0.0.0.0:3100. Non-root.
  - `localhost/bdc-web:latest` ← `infra/prod/web.Containerfile`: `docker.io/library/caddy:2` with admin dist at
    `/srv/admin`, portal dist at `/srv/portal`. Build arg `SITE_URL` (admin "View store"). The Caddyfile is NOT
    baked in; compose mounts `infra/prod/Caddyfile` at `/etc/caddy/Caddyfile`.
- Compose services (names = DNS names): `postgres`, `redis` (AOF `appendfsync everysec`), `garage`,
  `imgproxy`, `mailpit`, `api` (:4000), `shop` (:3100), `web` (Caddy :80), `cloudflared` (profile `tunnel`,
  `tunnel run` with `TUNNEL_TOKEN`; remote-managed tunnel: all public hostnames → `http://web:80`). Named
  volumes for every stateful service. Healthchecks; `api` waits for postgres/redis healthy.
- Hosts (Caddy, `auto_https off`, plain `http://` site blocks; Cloudflare terminates TLS):
  `{$BASE_DOMAIN}` → shop:3100 · `www.{$BASE_DOMAIN}` → redirect to apex · `admin.` → `/v1/*` api:4000, else
  /srv/admin SPA · `sr.` → `/v1/*` api:4000, else /srv/portal SPA · `img.` → imgproxy:8080 · `api.` → api:4000
  (memo share links, courier webhooks) · `mail.` → mailpit:8025 behind Caddy `basic_auth` (user `staff`, bcrypt
  hash from `.env` `MAIL_UI_HASH`): it holds OTPs, must never be open.
- Real client IP must reach the API (per-IP throttles): cloudflared sends `Cf-Connecting-IP`; read
  `apps/api/src/common/client-ip.ts` and set `TRUST_CF_HEADER` / `TRUST_PROXY` (compose network subnet, fix it
  in compose) so the API sees the visitor IP, not Caddy's.
- `infra/prod/.env` (gitignored; template `infra/prod/.env.example`, created by `infra/prod/gen-secrets.sh`,
  refuses to overwrite): `BASE_DOMAIN`, `PUBLIC_SCHEME` (https), `HTTP_PORT`, `TUNNEL_TOKEN`, Postgres
  password, Garage `GARAGE_RPC_SECRET` + `GARAGE_ADMIN_TOKEN`, S3 key id (`GK` + 24 hex) + secret (64 hex,
  imported with `garage key import`), `IMGPROXY_KEY/SALT`, `STAFF_TOTP_KEY`, `AFFILIATE_PAYOUT_KEY`,
  `OTP_SECRET`, `MAIL_UI_HASH`, `MAIL_FROM`, optional courier keys. API env in compose derives URLs:
  `ADMIN_ORIGIN=${PUBLIC_SCHEME}://admin.${BASE_DOMAIN}`, `PUBLIC_API_URL=…://api.…`, `IMGPROXY_URL=…://img.…`,
  `SMTP_URL=smtp://mailpit:1025`, `NODE_ENV=production`, `APP_STAGE=staging`, `SMS_PROVIDER=dev`,
  `DISABLE_2FA=false`, `SCHEDULER=1`.
- `infra/prod/init.sh` (idempotent, run once after first `up`): Garage layout + key import + bucket
  `products` + allow; API CLI seeds needed for a working shop (geo, couriers, pages `--publish`,
  `alpha-settings`; check `cli.ts` for names); prints how to run `create-owner`.

## Units

- **A (Sonnet) images**: owns `infra/prod/*.Containerfile`, `infra/prod/entrypoint-api.sh`,
  `.containerignore`, `apps/shop/next.config.ts` (standalone switch only) and minimal shop build-tolerance
  fixes. Verify: all 3 `podman build` succeed (`podman build -f infra/prod/<x>.Containerfile -t <tag> .`),
  `podman run --rm localhost/bdc-api:latest cli --help` (or similar) prints, shop image starts and serves
  `/` 200 or a clean API-down page (no crash), image sizes reported. Keep layers cache-friendly
  (pnpm fetch / store mount).
- **B (Sonnet) stack**: owns `infra/prod/compose.yaml`, `Caddyfile`, `garage.toml`, `.env.example`,
  `gen-secrets.sh`, `init.sh`, one line `infra/prod/.env` in root `.gitignore`. Verify: `podman compose -f
  infra/prod/compose.yaml config` clean, `caddy validate` via the caddy image, `gen-secrets.sh` output parses.
  Full bring-up waits for A's images (check `podman images localhost/bdc-*`); if ready, bring the stack up with
  `BASE_DOMAIN=bdc.localhost PUBLIC_SCHEME=http`, run init.sh, and curl: `http://bdc.localhost:8088/` 200,
  `http://admin.bdc.localhost:8088/v1/public/site` 200 (proxied), `http://api.bdc.localhost:8088/health`,
  `http://mail.bdc.localhost:8088/` 401 without auth.
- Later wave (Haiku): `infra/prod/backup.sh` + systemd user timer (nightly pg_dump custom format + Garage
  data copy, keep 14), `infra/prod/deploy.sh` (git pull → build 3 images → `up -d` → health check),
  `docs/deploy.md` (owner PC setup, tunnel + domain steps, first boot, update, restore drill).

## Rules

Never commit (lead commits). Never `pkill -f`. Don't touch the dev stack (`bdc-dev`) or `.env`. Don't edit
files outside your owned paths; ask the lead via your final report if something else must change. Report:
files changed, verify output (short), open issues.

## Wave 2 facts (from A + B, verified by lead, commit 9f02d8d)

- Build (repo root, default podman store): `podman build -f infra/prod/api.Containerfile -t localhost/bdc-api:latest .`;
  shop needs `--build-arg API_URL=http://api:4000 --build-arg SITE_URL=<scheme>://<BASE_DOMAIN>`; web needs
  `--build-arg SITE_URL=…`. Values come from `infra/prod/.env` (BASE_DOMAIN, PUBLIC_SCHEME).
- Run: `cd infra/prod && podman compose up -d --no-build` (compose has `build:` blocks + `pull_policy: never`;
  plain `up` would try to build). Tunnel: add `--profile tunnel` (needs `TUNNEL_TOKEN`). Down keeps volumes.
- Health: `curl -sf http://api.$BASE_DOMAIN:$HTTP_PORT/health` from the host works locally (bdc.localhost); on the
  owner PC with a real domain use `curl -sf -H "Host: api.$BASE_DOMAIN" http://127.0.0.1:$HTTP_PORT/health`.
- Container healthchecks use `podman exec` (broken on the dev PC); don't rely on `healthy`.
- First boot: `infra/prod/gen-secrets.sh` → edit `.env` → build → up → `infra/prod/init.sh` → create owner:
  `podman compose run --rm -T --no-deps api cli create-owner` (run it from `infra/prod`; check `apps/api/src/cli.ts` for args).
- Volumes (project `bdc-prod`): read the volume names from `infra/prod/compose.yaml`. Postgres service `postgres`, user/db/password vars in `.env.example`.
- `podman exec` fallback: `podman run --rm --network container:<c> --volumes-from <c> <image> <cmd>` (see `ctr_exec` in `dev.sh`).
- Tunnel routes (Cloudflare dashboard → tunnel → Published application, service HTTP `web:80`): apex, www,
  admin, sr, img, api, mail. Mail UI user `staff`, password printed once by gen-secrets.sh (bcrypt hash in .env).

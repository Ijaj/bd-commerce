# 13 — Tech Stack [DECIDED]

Decided 2026-10-23 (S-T1 – S-T28 in doc 10). Hard requirements: lightweight storefront, fast Android app, small year-1 scale (<5k products, <100 orders/day).

## Apps (monorepo: pnpm + Turborepo)
| Path | What | Stack |
|---|---|---|
| `apps/shop` | Customer storefront (EN/BN) | Next.js (React) on Node.js LTS, **plain CSS** (no CSS framework). Keep client JS small: server components, few client libs |
| `apps/admin` | Admin panel (separate subdomain) | Vite + React SPA, Mantine, **heavily customized to match the approved mockups (C60)**; no stock look |
| `apps/api` | REST API for shop, admin, Android, supplier/affiliate portals | NestJS on Node.js LTS, Prisma (migrations from day 1) |
| `apps/android` | Android app (after web launch, Q5) | Native Kotlin, Jetpack Compose |
| `packages/*` | Shared code | Generated TS API client, BN/EN + digit helpers, shared constants |

- API contract: NestJS generates OpenAPI; TS clients (shop/admin) and Kotlin client (Android) are generated from it.
- Supplier portal + affiliate dashboard: hosting app not yet decided (admin app or shop) — decide at roadmap/coding time.

## Data & services
- **PostgreSQL** — main DB; `jsonb` for `{en,bn}` text and flexible attributes; built-in full-text search at launch (English only, Q30).
- **Redis** — BullMQ job queue (SMS, email, courier booking, image jobs, schedules), cache, rate limiting.
- **Garage + imgproxy** (C6) — product images (S3-compatible storage + on-the-fly resizing to WebP/AVIF).
- **Sessions** — DB-backed; httpOnly secure cookie (web/admin), opaque token (Android). Instant logout/revoke, staff timeout (Q68).
- **Email** — Amazon SES. **SMS** — provider TBD, swappable (Q75). **Couriers** — Steadfast + Pathao APIs (Q72).

## Hosting (self-hosted, one owner PC — C96)
- **One owner gaming PC**, public static IP, domain DNS points straight at it, **Podman Compose**. Same machine for the test run and production.
- **Caddy** on 80/443 (router forwards both) issues Let's Encrypt certs. No Cloudflare Tunnel/CDN: IP is public, no DDoS shield, images served from the home uplink.
- **No replica / failover**: Postgres + Redis (AOF 1s) on the same PC. UPS advised.
- **Backups**: nightly local dumps (`infra/prod/backup.sh`), copied off the machine by hand (C97).

## Ops
- **CI/CD**: GitHub Actions runs tests; self-hosted runner on an owner PC builds images + restarts services with Podman on merge to `main`.
- **Monitoring**: Uptime Kuma (uptime + alerts), GlitchTip (errors), Beszel/Netdata (host health).
- **Secrets**: SOPS + age encrypted file in repo → Podman secrets at deploy.
- **Testing**: Vitest (unit + API against test Postgres in Podman), Playwright (browse → cart → checkout → admin order flow).

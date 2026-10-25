# 13 — Tech Stack [DECIDED]

Decided 2026-10-23 (S-T1 – S-T28 in doc 10). Hard requirements: lightweight storefront, fast Android app, small year-1 scale (<5k products, <100 orders/day).

## Apps (monorepo: pnpm + Turborepo)
| Path | What | Stack |
|---|---|---|
| `apps/shop` | Customer storefront (EN/BN) | Next.js (React) on Node.js LTS, **plain CSS** (no CSS framework). Keep client JS small: server components, few client libs |
| `apps/admin` | Admin panel (separate subdomain) | Vite + React SPA, Tailwind + Mantine (stock Mantine styling as much as possible) |
| `apps/api` | REST API for shop, admin, Android, supplier/affiliate portals | NestJS on Node.js LTS, Prisma (migrations from day 1) |
| `apps/android` | Android app (after web launch, Q5) | Native Kotlin, Jetpack Compose |
| `packages/*` | Shared code | Generated TS API client, BN/EN + digit helpers, shared constants |

- API contract: NestJS generates OpenAPI; TS clients (shop/admin) and Kotlin client (Android) are generated from it.
- Supplier portal + affiliate dashboard: hosting app not yet decided (admin app or shop) — decide at roadmap/coding time.

## Data & services
- **PostgreSQL** — main DB; `jsonb` for `{en,bn}` text and flexible attributes; built-in full-text search at launch (English only, Q30).
- **Redis** — BullMQ job queue (SMS, email, courier booking, image jobs, schedules), cache, rate limiting.
- **MinIO + imgproxy** — product images (S3-compatible storage + on-the-fly resizing to WebP/AVIF), cached by Cloudflare.
- **Sessions** — DB-backed; httpOnly secure cookie (web/admin), opaque token (Android). Instant logout/revoke, staff timeout (Q68).
- **Email** — Amazon SES. **SMS** — provider TBD, swappable (Q75). **Couriers** — Steadfast + Pathao APIs (Q72).

## Hosting (self-hosted, owner PCs)
- 2–3 owner PCs, public static IP, **Podman Compose per PC**.
- **Cloudflare Tunnel** in front: no open ports, IP hidden, DDoS + SSL + CDN caching (free tier: 100 MB per request upload limit).
- **Postgres primary + streaming replica** on a second PC (manual promote). **Redis AOF (1s) + replica**.
- **Power/ISP**: online UPS/IPS for PCs + router, 2 ISPs with failover.
- **Backups**: local only for now (other PCs, same site). Not protected against fire/theft/flood at the site.
- Example split (final at setup): PC1 shop + admin + API, PC2 Postgres primary + Redis, PC3 replicas + MinIO + monitoring.

## Ops
- **CI/CD**: GitHub Actions runs tests; self-hosted runner on an owner PC builds images + restarts services with Podman on merge to `main`.
- **Monitoring**: Uptime Kuma (uptime + alerts), GlitchTip (errors), Beszel/Netdata (host health).
- **Secrets**: SOPS + age encrypted file in repo → Podman secrets at deploy.
- **Testing**: Vitest (unit + API against test Postgres in Podman), Playwright (browse → cart → checkout → admin order flow).

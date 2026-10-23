# bd-commerce — Session Handoff

General-purpose e-commerce for Bangladesh. **Planning phase only — no code until all planning gates in `plan/README.md` are done.** Tech stack is decided last.

## Standing rules for this project

- **At the end of every session (or when the user says they're stopping), update the "Resume state" section below** so the next session can continue without re-reading everything.
- Ask decisions with the AskUserQuestion tool (user prefers this), max 4 per call. Never decide for the user; recommend, then ask.
- Log every answer in `plan/10-decisions-log.md`; mark `[DECIDED]` in the topic docs; new questions go into `plan/08-open-questions.md` with the next Q number.
- Token budget matters (user on $20 plan): read only the files you need, don't re-read the whole plan. `plan/10-decisions-log.md` is the compact source of truth for decisions.
- Flowcharts: edit `plan/flowcharts/flows.js` only, then run `node plan/flowcharts/to-md.mjs` to regenerate `plan/11-flowcharts.md`. Never hand-edit the md. Animated viewer: `plan/flowcharts/index.html` (dagre + GSAP, file://).
- User wants big visual/UI work delegated to a Sonnet/Haiku sub-agent with a precise spec. No Artifacts unless asked.
- Old reference project: `~/webdev/baby-commerce` (lessons in `plan/09-baby-commerce-reuse.md`).

## Resume state (last updated 2026-10-23, session 5)

- Gates 1–7 done; SR mockups approved (C1). **Gate 8 coding in progress.** Decisions C1–C8 in doc 10: step 1 in 4 sub-steps (1a stack/CI, 1b Prisma+Nest+OpenAPI, 1c staff auth/2FA/sessions/RBAC, 1d settings/flags/EN-BN/maintenance), foundation tables only, commit to main, Node 24, Garage (not MinIO), Biome, TypeScript 7 (fall back to 6.0 per app if a tool breaks).
- **1a done** (e3dcc56, CI green): root pnpm/turbo/biome/tsconfig.base, `infra/dev` compose (Postgres 18, Redis 8, Garage v2.4.1, imgproxy v3.31.4), `pnpm stack:up|init|down|reset`, `.env.example`, `.github/workflows/ci.yml`. Verified S3 upload + signed imgproxy WebP.
- **1b done**: `apps/api` NestJS 11.2.7 + Prisma 7.10.1 (pg adapter, `prisma.config.ts`, client in src/generated, no models yet) + ioredis, Zod env, nestjs-zod global pipe, `/health` (db+redis), `/v1` prefix, Swagger `/docs`. Built with plain `swc` (Nest CLI needs TS compiler API, absent in TS 7.0). `packages/api-client` = openapi-fetch + generated types (uses TS 6.0.3: openapi-typescript needs compiler API). `pnpm api:gen`; CI checks drift. Decisions C9–C12. pnpm 11 enforces min release age + `allowBuilds` in pnpm-workspace.yaml.
- **1c done**: Prisma migration `staff_auth_rbac` (staff, sessions, known devices, backup codes, permissions, roles, joins). `/v1/admin/auth` login → 2FA setup/enable (10 backup codes) or verify (TOTP replay guard, backup codes once), logout, me, password change; Redis login throttle (5/email, 30/IP per 15 min); new-device email via Mailpit (dev) / SMTP; idle 8h default + 7-day cap. `/v1/admin/staff|roles|permissions` with Q65 grant rule, last-Owner guard, 2FA reset (C14, stored on staff row; audit log is not in P1). Permission catalog in `src/auth/permissions.ts`, synced at boot; Owner = system role. CLI `pnpm --filter @bdc/api cli create-owner|reset-2fa`. 16 tests. Decisions C13–C16. Dev DB has owner@bdc.test (temp password not kept; create another owner if needed).
- **1d done → P1 step 1 (foundation) complete.** `settings` table (overrides only) + code registry `apps/api/src/settings/registry.ts` (maintenance_mode, announcement_bar with time window, staff_session_timeout_min, flags online_payments/advance_payments/preorders all off), Redis cache 5 min + invalidate on write, admin `/v1/admin/settings` (returns JSON Schema per key), public `GET /v1/public/site`, maintenance middleware (503 except admin/site/health/docs). Perms settings.view/manage. `packages/i18n` (built with TS 7 tsc, ESM): formatPrice(paisa), formatNumber, digits, pickText. 22 API + 18 i18n tests. Decisions C17–C19 (7-day session cap, no audit log in P1, own settings tables).
- **Next:** check in with owner, then P1 step 2 (see plan/14-roadmap.md row 2). Ask owner tool choices first.
- Repo: GitHub `Ijaj/bd-commerce` (main). Commit + push after each step.
- Owner prefs: ask every decision via AskUserQuestion, never decide; explain pros/cons when asked; local model (unsloth) was down sessions 4–5.
- Lesson: resume stopped agents with SendMessage rather than respawning; stale agents from a previous session can still run and collide.

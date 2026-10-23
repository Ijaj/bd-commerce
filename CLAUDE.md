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
- **Next:** check in with owner, then 1b (apps/api NestJS + Prisma + OpenAPI client gen into packages/). Ask owner any tool choices first (AskUserQuestion).
- Repo: GitHub `Ijaj/bd-commerce` (main). Commit + push after each step.
- Owner prefs: ask every decision via AskUserQuestion, never decide; explain pros/cons when asked; local model (unsloth) was down sessions 4–5.
- Lesson: resume stopped agents with SendMessage rather than respawning; stale agents from a previous session can still run and collide.

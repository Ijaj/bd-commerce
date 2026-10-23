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

## Resume state (last updated 2026-10-23, session 4 end)

- Gates 1–7 done. Docs: features 01–07, decisions `plan/10-decisions-log.md` (Q1–Q120, S1–S36, S-T1–S-T28, R1–R25), flowcharts, data model `plan/12-data-model.md` (incl. 8b SR/B2B), mockups `plan/mockups/` (owner approved), tech stack `plan/13-tech-stack.md`, roadmap `plan/14-roadmap.md`.
- Repo: GitHub `Ijaj/bd-commerce` (main). Commit + push after each step.
- Session 4 decisions: Q111 advance %s summed (cap 100%), Q112 admin EN only, Q113 no bold in storefront (admin exempt), Q114–Q117 availability filter + upcoming products (wishlist only) + admin option editor, tech stack (TS monorepo pnpm+Turbo, Next.js shop plain CSS, Vite+React+Mantine admin, NestJS+Prisma+Postgres, Kotlin Compose Android, self-hosted owner PCs + Podman Compose + Cloudflare Tunnel, MinIO+imgproxy, BullMQ+Redis, SES), roadmap 4 phases (P1 COD launch, P2 payments, P3 growth, P4 Android), new **SR/B2B module in P1** (field SRs sell our stock to independent shops; approval, due ledger, memo, targets, commission on collected money), one partner portal app (`apps/portal`) for SR + supplier + affiliate.
- **In progress at session end:** Sonnet agent building SR portal mockups (`plan/mockups/sr/`) + admin pages (sr-approvals, b2b-shops, sr-team, b2b-dues) + hub links. May be incomplete/uncommitted. **Next session first:** `git status` in repo; check those files exist, load headless for JS errors, screenshots in scratchpad if any; finish or re-spawn agent with same spec (spec = R10–R20, Q119–Q120, doc 12 §8b, match supplier/affiliate portal style, admin per CONTRACT.md). Then commit.
- **Then:** owner reviews SR mockups → gate 8 coding starts with P1 slice 1 (foundation, see doc 14).
- Open questions: none.
- Owner prefs: ask every decision via AskUserQuestion, never decide; explain pros/cons when asked; local model (unsloth) was down this session.
- Lesson: 6 parallel Sonnet agents hit the session usage limit once; resume stopped agents with SendMessage rather than respawning.
- Untested in flowchart viewer: pinch zoom; Fit-all on the 32-node checkout flow renders small.

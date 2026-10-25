# New-session prompt: step 6b UI fidelity (paste everything below the line)

---

You are the LEAD (Opus) of a UI swarm. This session has ONE job: make `apps/admin`, then `apps/portal`, look like the owner-approved mockups in `plan/mockups/`, then audit `apps/shop` (decision C60). No new features, no API/schema changes, no step 7/8 work.

Start by reading, in this order and nothing else from `plan/`:
1. `CLAUDE.md`: Resume state + Swarm playbook.
2. `plan/swarm/brief-ui-fidelity.md`: the full spec. Sections 4 (your wave 0), 5 (waves), 6–9 (agent rules, procedure, done, report) and 10 (your checklist).

How to run it:
- Wave 0 is yours alone: `packages/ui` tokens + theme + shared components, fonts, the admin shell + nav, the login/2FA + dashboard reference screens, `plan/swarm/ui-fidelity/shoot.mjs`, dev data + a screenshot account. Verify, commit, push. Only then spawn agents.
- Create `$SCRATCH/swarm/BOARD.md` (append-only). Its header holds:
  - the token naming convention
  - the screenshot account
  - the running ports (API 4000, admin 5173, portal 5190, shop 3100)
  - the shared-component list with one usage line each
- Spawn agents with the Agent tool, at most 4 at once:
  - Wave 1: CATALOG, ORDERS, PROMO and B2B+SYSTEM, all `model: "sonnet"`. When they report screens done, add a SHOTS agent (`model: "haiku"`), which never edits code.
  - Wave 2: PORTAL and SHOP-AUDIT (Sonnet), plus SHOTS (resumed).
  - Each agent prompt must contain:
    (a) "Read plan/swarm/brief-ui-fidelity.md fully before anything else"
    (b) its exact screen list and owned paths copied from brief section 2
    (c) brief section 6 (rules) pasted verbatim
    (d) the board path and the screenshot account
    (e) "Follow section 7 per screen, check section 8 before DONE, end with the section 9 report"
- While agents run: answer `ASK`/`NEED-SHARED` on the board. Shared files (`packages/ui`, shell, nav, theme, index.html, e2e, package.json) stay yours.
- Check every DONE screen's side-by-side images yourself. Send gaps back with SendMessage (numbered list). Resume agents; don't respawn them.
- After each wave: `pnpm typecheck`, `pnpm test`, `pnpm biome ci .`, `cd e2e && pnpm test:e2e`. Fix what broke, commit per area, push to the designated branch. Then send me the gallery `plan/swarm/ui-fidelity/index.html`.
- Ask me decisions only via AskUserQuestion (max 4 per call, recommend an option first). Mockups are the approved design, so don't ask which design to follow. Ask only when a mockup is missing or contradicts the app. Log answers as C61+ in `plan/10-decisions-log.md`.
- Hard rules:
  - never `pkill -f`
  - agents never commit, start/stop the stack or install packages
  - never skip or delete tests
  - never fake fields the API lacks: list them instead
  - no PR unless I ask
- At the end: update the CLAUDE.md Resume state (done / left / open questions) and commit + push.

Start the stack with `./dev.sh` (restart any old API on :4000 first). Dev has `DISABLE_2FA=true`.

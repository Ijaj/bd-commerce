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

## Resume state (last updated 2026-10-23, session 4)
- Gates 1–4 done (features, Q1–Q95 + S1–S36, 9 flowcharts, data model `plan/12-data-model.md`).
- Gate 5 in progress. Round 5 Q96–Q99: static HTML mockups in `plan/mockups/` (file://, dark mode + EN/BN, mobile preview), name placeholder `ShopName`, Sonnet sub-agent in batches.
- Q100–Q102: brand still open → A/B/C switcher on every page (`shared/brand-*.css`, `?brand=`); audit fixes applied in batch 2a.
- Batch 2a done: foundation (`shared/core.js` = `Shop.*` API, `boot.js`, per-page `page-*.js`, `pages.css`), home/category/search/product pages. Cart in localStorage `shop.cart`.
- Batch 2b done: cart, checkout, payment, order-success, track, login, account, event (+ `shared/flow.js`, `auth.js`, `order-ui.js`). Demo: `?user=1`, `cart.html?demo=1`, orders BD-100219/100248/100174 phone 01711000000. All data localStorage.
- Round 5b Q103–Q110 decided: brand = B style + C colours (brand D), digits follow language (BN digits incl. prices; IDs/phones English), per-zone free delivery threshold, advance-payment rules Q106–Q108 (doc 12 updated, cod_advance_rules dropped), **launch = COD only** (online pay, advance, pre-order off; feature flags in settings), mockup Launch/Full toggle.
- Batch 2c done: brand D default (`shared/brand-d.css`), BN digits (`Shop.digits/num`, MutationObserver), per-zone `freeAbove`, advance calc in `flow.js` (`Shop.calc`), Launch/Full toggle (`shop.phase`, default launch).
- Batch 3 done (5 parallel Sonnet agents, contract `plan/mockups/admin/CONTRACT.md`, page list `admin/README.md`): 28 admin pages + `supplier/` + `affiliate/` portals. All 30 load headless with no JS errors (checked 2026-10-23). Admin data in-memory per group (`*-data.js`), not cross-linked. Linked from `plan/mockups/index.html`.
- Gate 5 mockups essentially complete — awaiting owner review.
- Session 4: Q111 = advance trigger %s ADDED (cap 100%/item; flow.js `Shop.calc`, doc 12, admin pages updated). Q112 = admin EN only. Repo on GitHub `Ijaj/bd-commerce` (main), first commit 41bbdf4.
- Session 4 later: Q113 no-bold storefront typography; Q114–Q117 availability filter (In Stock/Pre-Order/Up-coming, all 3 always shown), `upcoming` products (wishlist only, `Shop.cart.add` refuses; demo p=538,316,53,20,296; admin product-edit?id=103), admin option editor (EN+BN rows, drag, fixed + Add option in header).
- **Next step:** owner reviews admin + storefront mockups → tick gate 5 in `plan/README.md`, then gate 6 tech stack, gate 7 roadmap (mark launch phase per feature — owner: full plan, subset at launch, COD-only start).
- Open questions: none. Admin stays bold (owner said no to admin typography change).
- Lesson: 6 parallel Sonnet agents hit the session usage limit once; resume stopped agents with SendMessage rather than respawning.
- Untested in flowchart viewer: pinch zoom; Fit-all on the 32-node checkout flow renders small.

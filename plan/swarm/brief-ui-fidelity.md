# Step 6b — UI fidelity to the approved mockups (C60)

Audience: the lead (Opus) and every Sonnet/Haiku agent in the UI swarm. Agents: read this WHOLE file before touching code, then re-read the "Rules" and "Definition of done" sections before you report done.

## 0. Why this step exists

Steps 1–6 built `apps/admin` and `apps/portal` with stock Mantine and only the primary/accent colors copied (old decision S-T8). Nobody compared the screens with the mockups. The owner approved the **mockups**, not what is there now (C60). Wrong today:

1. **Colors.** Only indigo `#4338ca` / teal `#0f766e` were copied. Missing: page bg, surfaces, text, muted, borders, success/danger/sale, the `--hl` teal-300 highlight, and the whole dark palette.
2. **Shell.** Mantine `AppShell` with a 48px header and a 220px light navbar. The mockup has a 54px gradient top bar and a 236px dark sidebar.
3. **Top bar.** Missing: the uppercase-italic wordmark with an "ADMIN" tag, the global search with a teal 2px border, the notifications bell, the staff menu, "View store" and the theme switch.
4. **Sidebar.** No icons, group headings barely visible, no active-item left bar, wrong groups and labels.
5. **Light/dark.** No switch. The theme is `auto` only, and the brand tokens have no dark values in the app.
6. **Components.** Page header (left-bar title, crumbs, actions), stat tiles, tables, badges, tabs, buttons, cards, forms, modal/drawer and toasts are all stock Mantine.
7. **Fonts.** `apps/admin/index.html` loads no web fonts, so DM Sans never loads.

## 1. Sources of truth (read, never edit)

All paths are relative to the repo root. `plan/mockups/**` is read-only for everyone.

| What | File |
|---|---|
| Brand tokens (light + dark) | `plan/mockups/shared/brand-d.css` (layer on top of `plan/mockups/shared/base.css` defaults) |
| Admin shell, tokens, shared components | `plan/mockups/admin/shared/admin.css` |
| Admin page-group CSS | `plan/mockups/admin/shared/{sales,catalog,marketing,partners,sr,system}.css` |
| Admin shell markup, NAV, icon SVG paths (`IC`), theme logic | `plan/mockups/admin/shared/admin-core.js` |
| Per-page markup | `plan/mockups/admin/shared/page-<name>.js` + `plan/mockups/admin/<name>.html` |
| Component class names and their meaning | `plan/mockups/admin/CONTRACT.md` ("Shared CSS components") |
| SR portal | `plan/mockups/sr/{index.html,portal.css,portal.js}` (hash routes `#/home`, `#/new`, `#/sales`, `#/shops`, …) |
| Supplier / affiliate portals (not built yet; style reference only) | `plan/mockups/{supplier,affiliate}/` |
| Storefront | `plan/mockups/*.html`, `plan/mockups/shared/{base,pages,brand-d}.css` |

Open a mockup in the headless browser as `file://$REPO/plan/mockups/admin/orders.html?theme=dark` (`admin-boot.js` reads `?theme=light|dark`). Use `?theme=light` for light.

## 2. Screen map (mockup ↔ app ↔ owner)

| Mockup page | App route(s) (`apps/admin/src/routes/_app/…`) | Feature folder(s) | Agent |
|---|---|---|---|
| `login.html` | `login.tsx`, `2fa.setup.tsx`, `2fa.verify.tsx` | `components/AuthLayout.tsx` | LEAD (wave 0) |
| `index.html` (dashboard) | `index.tsx` | `features/shell` (dashboard part) | LEAD (wave 0, reference screen) |
| `products.html` | `catalog.products.index.tsx` | `features/products` | CATALOG |
| `product-edit.html` | `catalog.products.$id.tsx` | `features/products` | CATALOG |
| `categories.html` | `catalog.categories.tsx` | `features/categories` | CATALOG |
| `inventory.html` | `catalog.inventory.tsx` | `features/inventory` | CATALOG |
| (none: use `products.html` list style) | `catalog.brands.tsx` | `features/brands` | CATALOG |
| (none: use `inventory.html` + `settings.html` card style) | `catalog.import-export.tsx` | `features/import-export` | CATALOG |
| `orders.html` | `orders.index.tsx` | `features/orders` | ORDERS |
| `order.html` | `orders.$id.tsx` | `features/orders` | ORDERS |
| (none: `orders.html` list + call actions) | `call-queue.tsx` | `features/orders` | ORDERS |
| (none: `orders.html` list style, `order.html` shipment card) | `shipments.index.tsx` | `features/shipments` | ORDERS |
| `returns.html` | `returns.index.tsx`, `returns.$id.tsx`, `refunds.index.tsx` | `features/returns` | ORDERS |
| (none: keep layout, use tokens + fonts only) | `_print/*` invoice/labels | `features/documents` | ORDERS (light touch, never dark: print stays black on white) |
| `coupons.html` | `promotions.coupons.*` | `features/coupons` | PROMO |
| `flash-sales.html` | `promotions.flash-sales.*` | `features/flash-sales` | PROMO |
| (none: `coupons.html` editor style) | `promotions.bulk-sales.*` | `features/bulk-sales` | PROMO |
| `home-feed.html` | `content.carousel.tsx` | `features/carousel` | PROMO |
| `sr-approvals.html` | `b2b.sales.tsx` | `features/b2b` | B2B |
| `b2b-shops.html` | `b2b.shops.index.tsx`, `b2b.shops.$id.tsx` | `features/b2b` | B2B |
| (none: `b2b-dues.html` style) | `b2b.collections.tsx` | `features/b2b` | B2B |
| `b2b-dues.html` | `b2b.dues.tsx` | `features/b2b` | B2B |
| `sr-team.html` | `sr.team.tsx` | `features/sr` | B2B |
| `delivery.html` | `delivery.tsx` | `features/delivery` | B2B |
| `staff.html` | `staff.tsx` | `features/staff` | SYSTEM (merged into B2B if only 4 agents) |
| `roles.html` | `roles.tsx` | `features/staff` | SYSTEM |
| `settings.html` | `settings.tsx` | `features/settings` | SYSTEM |
| `sr/index.html` (all hash views) | `apps/portal/src/routes/**` | `apps/portal/src/features/**`, `components/**` | PORTAL (wave 2) |
| storefront `*.html` | `apps/shop/src/app/[lang]/**` | `apps/shop/src/**` | SHOP (wave 2, audit first, fix after lead OK) |

Mockup pages with no app screen yet (tickets, reviews, events, loyalty, affiliates, campaigns, customers, suppliers, purchase-orders, reports, audit): **do not build them** and leave them out of the menu.

## 3. Navigation (the lead builds this in wave 0)

Use the mockup groups, order, labels and icon keys (`admin-core.js` `NAV`). Pages the mockup lacks go in the nearest group. Keep existing route paths and `anyOf` permissions from `apps/admin/src/lib/nav.ts`.

| Group | Label (icon key) → route |
|---|---|
| Overview | Dashboard (dashboard) → `/` |
| Sales | Orders (orders) → `/orders` · Call queue (phone, keeps count badge) → `/call-queue` · Shipments (truck) → `/shipments` · Returns & refunds (returns) → `/returns` · Refunds (wallet) → `/refunds` |
| Catalog | Products (products) · Categories & attributes (categories) · Brands (products) · Inventory (inventory) · Import / Export (upload) |
| Marketing | Coupons & discounts (coupons) · Flash sales (flash) · Bulk sales (coupons) · Home & feed (home) → `/content/carousel` |
| People & partners | SR approvals (check) → `/b2b/sales` · B2B shops (suppliers) → `/b2b/shops` · Collections (wallet) → `/b2b/collections` · SR team (staff) → `/sr/team` · B2B dues (wallet) → `/b2b/dues` · Delivery & couriers (delivery) → `/delivery` |
| System | Staff (staff) · Roles & permissions (roles) · Settings (settings) |

Label changes break tests and e2e that click nav text. The lead greps `apps/admin/src/**/*.test.*` and `e2e/tests/**` and updates them in the same wave.

## 4. Wave 0: foundation (LEAD ONLY, before any agent starts)

The lead owns everything in this list for the whole session. Agents never edit these files.

1. **Tokens.** Create `packages/ui` (`@bdc/ui`, TS 7, ESM, same setup as `packages/i18n`) with:
   - `src/tokens.css`: every brand-D token as a CSS custom property with the `--bdc-` prefix, e.g. `--bdc-primary`, `--bdc-accent`, `--bdc-hl`, `--bdc-bg`, `--bdc-surface`, `--bdc-surface-2`, `--bdc-text`, `--bdc-muted`, `--bdc-border`, `--bdc-success`, `--bdc-danger`, `--bdc-sale`, `--bdc-warn`, `--bdc-info`, `--bdc-hdr-bg`, `--bdc-sidebar-bg`, `--bdc-sidebar-fg`, `--bdc-sidebar-h`, `--bdc-r-sm/r/r-lg`, `--bdc-sh-1/sh-2`, the chart series `--bdc-c1..c6`, and the admin sizes `--bdc-side-w: 236px` and `--bdc-top-h: 54px`.
   - Light values go under `:root`. Dark values go under `[data-mantine-color-scheme=dark]`, copied exactly from `brand-d.css` and `admin.css`.
   - If agents could use a bare name from the mockups (`--primary`), alias it to the prefixed one so they can copy mockup CSS mostly unchanged. Write the chosen convention in the board header.
2. **Mantine theme** (`packages/ui/src/theme.ts`, used by admin and portal):
   - Build the color tuples so the shade Mantine uses resolves to the token in light AND dark.
   - Fonts: DM Sans + Noto Sans Bengali for admin (from `admin.css`). For the portal, check `sr/portal.css`/`index.html` and use what they load.
   - Radius 3/4/6. Shadows `--bdc-sh-*`. Spacing and font sizes as in `admin.css`.
   - `components` overrides (via `classNames` + a CSS file) for Button (uppercase + letter-spacing as `.a-btn`, variants primary/accent/ghost/danger), Badge (angular, uppercase, `.a-badge.ok/.warn/.danger/.info/.muted`), Table (`.a-table`: sticky header, dense rows, hover, `.num` right), Tabs (`.a-tabs`/`.a-tab` with a count bubble), Paper/Card (`.a-card`, `-h`, `-b`), inputs (`.a-field`), Switch, Modal, Drawer, Menu, Tooltip, Notification (`toast`), Pagination (`.a-pager`), Timeline (`.a-timeline`), Stepper (`.a-steps`).
   - Mantine color scheme drives `data-mantine-color-scheme`. Persist the user's choice (light/dark/system) with Mantine's `localStorageColorSchemeManager` (key `bdc.theme`).
3. **Fonts.** Add the Google Fonts `<link>` tags to `apps/admin/index.html` and `apps/portal/index.html`, exactly as in the mockup head.
4. **Shared components** in `@bdc/ui`. Each is a thin wrapper over Mantine plus a CSS module copying the mockup CSS, and each takes its look only from tokens:
   - `Icon`: port the `IC` SVG paths from `admin-core.js` 1:1 (same viewBox/stroke). Usage: `<Icon name="orders" size={17} />`.
   - `PageHeader`: title with a 5px left bar, crumbs, actions slot (`.a-ph`).
   - `StatTile` (`.a-stat`, with `.up/.down` delta), `StatusBadge` (maps a status string to ok/warn/danger/info/muted; one map per domain lives in the feature, and the component takes the tone).
   - `Toolbar` (`.a-toolbar`), `EmptyState` (`.a-empty`), `KeyValue` (`.a-kv`), `SplitPane` (`.a-split`), `TableWrap` (`.a-table-wrap`, horizontal scroll on mobile), `SectionCard` (`.a-card` with header row + actions).
5. **Admin shell** (`apps/admin/src/features/shell/AppLayout.tsx`): rebuild it to match `admin-core.js`/`admin.css`:
   - Fixed 54px gradient top bar: wordmark ("SHOP" + teal bold part + "ADMIN" tag), global search input (teal 2px border; wire it as UI only if no search API exists, with a placeholder and the board noting "no global search API"), notifications bell (static empty dropdown "No notifications" unless a source exists), theme switch (light/dark/system), staff menu (change password, logout), "View store" link to `SITE_URL`.
   - Fixed 236px dark sidebar: group headings (uppercase 10.5px, letter-spacing .09em, `--bdc-sidebar-h`), items with a 17px icon, active item with the `--bdc-hl` 3px left border and `rgba(255,255,255,.12)` background, hover state, footer text.
   - Mobile ≤ 640px: burger → drawer.
   - Keep the call-queue count badge, the permission filtering (`visibleNav`) and `isActive`.
6. **Reference screens:** login + 2FA (`AuthLayout`) and the dashboard. Bring them to "done" (section 8) yourself, so agents have a worked example of tokens + components + screenshot comparison.
7. **Screenshot tool** `plan/swarm/ui-fidelity/shoot.mjs` (Node, `require('playwright')`, no install). Usage: `node plan/swarm/ui-fidelity/shoot.mjs <name> <mockupPathOrHash> <appPath> [--portal|--shop]`.
   - It shoots both sides at 1440×900 and 390×844, light and dark, full page.
   - Output: `plan/swarm/ui-fidelity/<name>/{mockup,app}-{desktop,mobile}-{light,dark}.jpg` (JPEG q60).
   - App login: POST `http://localhost:4000/v1/admin/auth/login` (dev has `DISABLE_2FA=true`) with the screenshot staff account, reuse the cookie as Playwright storage state, set theme via `localStorage['bdc.theme']` in an init script.
   - Also writes `<name>/side-by-side-*.jpg` (mockup left, app right, one image) using an HTML page that shows both, because agents compare those.
8. **Dev data.** Start the stack (`./dev.sh`; restart any old API on :4000). Create a screenshot owner (`pnpm --filter @bdc/api cli create-owner shots@bdc.test Shots`, then set a known password through the staff API or reset). Run `seed-demo` so lists are not empty. Put the credentials in the board header. Then place a few orders via the shop or e2e helpers, so orders/shipments/returns screens have rows.
9. **Verify and commit.** Typecheck + tests for admin and portal, `pnpm biome ci .`, e2e. Commit "ui: brand-D tokens, theme, shell, shared components (C60)".
10. **Board.** Write the swarm brief copy and the board in the session scratchpad (`swarm/BOARD.md`). Spawn agents only after this.

## 5. Waves

Never more than 4 agents at once (usage limit; 7 at once hit the 5-hour cap before).

| Wave | Agents (model) | Work |
|---|---|---|
| 0 | lead | section 4 |
| 1 | CATALOG (Sonnet), ORDERS (Sonnet), PROMO (Sonnet), B2B+SYSTEM (Sonnet) | admin screens per section 2 |
| 1b | SHOTS (Haiku) | after each agent reports DONE: re-run `shoot.mjs` for its screens, build the `plan/swarm/ui-fidelity/index.html` gallery (one row per screen: side-by-side light/dark desktop/mobile), report missing/blank shots. No code edits. |
| 2 | PORTAL (Sonnet), SHOP-AUDIT (Sonnet), SHOTS (Haiku, resumed) | Portal: restyle to `sr/` mockup using `@bdc/ui` (portal stays mobile-first, EN/BN toggle stays). Shop: produce a gap list per page (`plan/swarm/ui-fidelity/shop-gaps.md`) with screenshots. Fix only what the lead approves from that list (shop is plain CSS in `apps/shop/src/styles/tokens.css` + CSS modules; no Mantine there). |
| 3 | resume the same agents via SendMessage | owner review fixes |

Resume a finished agent with SendMessage (it keeps its context) instead of spawning a new one.

## 6. Agent rules (paste into every agent prompt)

1. **Ownership.** Edit ONLY your owned paths: your feature folders from section 2, plus the route files for those screens.
   - Never edit: `packages/ui/**`, `apps/*/src/theme.ts`, `features/shell/**`, `lib/nav.ts`, `index.html`, `main.tsx`, package.json/lockfile, `e2e/**`, `apps/api/**`, `plan/mockups/**`, or another agent's folder.
   - Need a shared change? Post `NEED-SHARED` on the board with the exact change you want and keep working around it (local CSS module) until the lead answers.
2. **Presentation only.** Never change:
   - API calls, query keys, mutations, form validation, permission checks or route paths.
   - Behavior: what buttons do, which fields exist.
   - `data-testid`, `aria-label`, `name`, or the `label` text that tests and e2e select by. If the mockup wording differs, grep `apps/admin/src` tests and `e2e/tests` for the old text. If it is used there, keep it and note it on the board as `ASK`.
3. **Fields and actions.** The mockup may show fields or actions that the API does not support. Do NOT add them. Copy their *style*, not their existence, and list them in your report as "mockup has X, not built".
   - The app may have fields the mockup lacks. Keep them, styled like the nearest mockup element.
4. **Look comes only from tokens + `@bdc/ui` components + Mantine props.**
   - No hex/rgb colors in TSX or CSS (only `var(--bdc-…)`).
   - No inline `style={{…}}` for colors, spacing or fonts. Use a `*.module.css` next to the component, named after it.
   - Prefer `@bdc/ui` components (`PageHeader`, `StatTile`, `StatusBadge`, `SectionCard`, `TableWrap`, `Toolbar`, `EmptyState`, `KeyValue`, `Icon`) over hand-made versions.
5. **Copy mockup CSS faithfully:** sizes, paddings, gaps, font sizes and weights, letter-spacing, uppercase, borders, radius, column order, alignment of numbers (right), date/price formats (`formatPrice` from `@bdc/i18n` gives `৳1,25,000`).
6. **Both themes, both widths.** Every screen must look right in light AND dark, at 1440px and 390px. Tables scroll horizontally inside `TableWrap` on mobile; the page itself never scrolls sideways.
7. **States.** Style loading (skeleton or loader in a card), empty (`EmptyState` with the mockup's wording style), error (red alert card), and disabled/no-permission states too, not only the happy path.
8. **Do not touch infrastructure:**
   - Never commit or push.
   - Never `pkill -f` (it can kill your own shell).
   - Never start/stop the stack, `dev.sh`, the API or the dev servers. The lead keeps admin :5173, portal :5190, shop :3100 and API :4000 running. If one is down, post `BLOCKED`.
   - Never run `pnpm install`/`add`. Ask the lead.
9. **Tests.** Run only your app's tests:
   - `pnpm --filter @bdc/admin test -- <your feature folder>` and `pnpm --filter @bdc/admin typecheck`
   - Format: `pnpm biome check --write <your files>`
   - Fix tests that break because markup changed (e.g. a role/text query that moved), never by deleting assertions. Never skip a test.
10. **Board.** Post to `$SCRATCH/swarm/BOARD.md` with append-only lines: `[HH:MM] [AGENT] [START|DONE|BLOCKED|ASK|NEED-SHARED|NOTE] message`. Never edit or delete earlier lines. Read the board before starting each screen (the lead posts answers there).
11. **Ask instead of guessing.** If a mockup is ambiguous or two mockup pages disagree, post `ASK`, pick the most common mockup pattern for now and note it in your report.

## 7. Per-screen procedure (agents)

For EACH screen in your list, in this order:

1. Post `START <screen>`.
2. Read the mockup:
   - The page's `page-<name>.js`: what markup and classes it renders.
   - The CSS rules for those classes in `admin.css` + the group CSS.
   - Note layout grid, header actions, toolbar/filters, tabs, table columns, badge tones, card arrangement, empty state.
3. Read the app screen: route file + feature components. List which mockup elements map to which components.
4. Baseline: `node plan/swarm/ui-fidelity/shoot.mjs <screen> <mockup page> <app path>`. Open the side-by-side images (Read tool on the .jpg) and write a short gap list (numbered) in your notes.
5. Restyle until every gap is closed or listed as "not built / API lacks".
6. Re-shoot. Compare all 4 side-by-sides (desktop/mobile × light/dark). Repeat steps 5–6 until they match: same structure, colors, spacing rhythm, typography and states. Pixel-identical is not required; "same design" is.
7. Run tests + typecheck + biome for your files (rule 9).
8. Post `DONE <screen>` with the image folder and any "not built" items.

## 8. Definition of done (per screen)

- [ ] Side-by-side images exist for desktop/mobile × light/dark and the app matches the mockup's structure, colors, typography, spacing and component styles.
- [ ] No hex colors, no inline style for look, no stock-Mantine look left (default blue, default radius, default table/badge/button).
- [ ] Loading / empty / error / no-permission states styled.
- [ ] Mobile: no sideways page scroll, tables scroll in their wrapper, actions wrap.
- [ ] Behavior unchanged. Tests, typecheck and biome green for the app.
- [ ] Gaps that need API work are listed, not faked.

## 9. Agent final report format (last message)

```
AGENT: <name>   SCREENS: <list>
DONE: <screen> → plan/swarm/ui-fidelity/<screen>/
NOT BUILT (mockup shows, API lacks): <screen>: <items>
TEXT KEPT FOR TESTS (mockup wording differs): <items>
NEED-SHARED still open: <items>
TESTS: admin <n> passed / typecheck ok / biome ok
FILES CHANGED: <paths>
```

## 10. Lead checklist per wave

1. Read the board every time an agent reports. Answer `ASK`/`NEED-SHARED` within the same turn (shared changes are lead-only; announce on the board when done).
2. Spot-check every DONE screen's side-by-side images yourself. Send it back (SendMessage, with numbered gaps) if it is not close.
3. After the wave:
   - `pnpm typecheck`, `pnpm test`, `pnpm biome ci .`, `cd e2e && pnpm test:e2e` (never `E2E_SKIP_BUILD=1`).
   - Fix e2e selectors only where labels intentionally changed.
4. Commit per area (`ui(admin/catalog): match mockups (C60)` etc.), with the attribution lines from the session's system reminder. Push to the session's designated branch. Do not open a PR unless the owner asks.
5. Build or refresh `plan/swarm/ui-fidelity/index.html` (gallery, via the SHOTS agent) and send it to the owner for review (SendUserFile, render).
6. At the end, update the CLAUDE.md "Resume state": what is done, what is left, open ASKs. Log any new owner decision as C61+ in `plan/10-decisions-log.md`.

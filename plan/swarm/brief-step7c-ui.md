# Step 7c UI brief: affiliates (shop + admin)

Repo `/home/ijaj/webdev/bd-commerce`. API contract = `plan/swarm/brief-step7c.md` "Endpoints" (read it; agent A's DONE note on `plan/swarm/BOARD-step7c.md` lists deviations, read that too). Typed client: `packages/api-client` (lead already ran `pnpm api:gen`). Decisions C67–C70, C81–C84 (grep `plan/10-decisions-log.md`). Board: `plan/swarm/BOARD-step7c.md`, append-only, `[agent HH:MM] msg`.

## Hard rules

- No git writes. Don't touch `apps/api/**`, `packages/**`, root configs, the other agent's paths. Need an API change → board.
- No stack start/stop, no `pkill -f`, no dev servers on default ports (lead browser-checks later).
- **UI must match the mockups (C60, C61)**: open the mockup files first and reuse `@bdc/ui` classes/components (`packages/ui`: `.a-*` classes, `PageHeader`, `StatTile`, `StatusBadge`, `Toolbar`, `EmptyState`, `KeyValue`, `SectionCard`, `Banner`, `TableWrap`). Stock Mantine look is rejected. Read 2 neighbour features first and copy their structure (queries/logic/components split, tests).
- Money via `@bdc/i18n` `formatPrice(paisa)`; rates bp → `%` with 1 decimal max. Files ≤ ~300 lines. Biome clean on your paths. Tests with Vitest + Testing Library like neighbours. Before DONE: app typecheck + app tests + `pnpm biome check <paths>`; report exact results.

## Agent U1 — shop (owns `apps/shop/src/app/[lang]/account/affiliate/**`, `apps/shop/src/features/affiliate/**`, `apps/shop/test/affiliate*`; small hook edits allowed in the cart coupon box component, the root layout/client provider for `?ref=` capture, account nav, i18n message files — post each on the board)

Mockup: `plan/mockups/affiliate/` (`index.html`, `portal.js`, `portal.css`): tabs Dashboard, Links & code, Payouts, Payout details. It was drawn as a portal; render it inside the shop account layout (C67) with shop tokens, keep its content/layout. EN + BN strings (BN in the existing message files; mark `// TODO native review`).

1. `/account/affiliate`: not joined → join card (displayName, website optional, desired code optional, program rules text: rate, approval after delivery + return window, min payout, last click wins 30 days, self-purchases don't count). Program off and not joined → info card, no form.
2. Joined → tabs: **Dashboard** (stat tiles clicks/orders/conversion/pending/balance/paid; 30-day clicks+orders bars like the mockup, plain SVG/CSS, no chart lib; commissions table with status badges, paging; suspended banner), **Links & code** (link generator: paste a shop URL or path → `{origin}{path}?ref=CODE`, copy button; code card; refuse other-site URLs), **Payouts** (list), **Payout details** (bKash / bank form → PUT, shows masked value after save; never prefill full numbers).
3. `?ref=CODE` capture: on any page load with `ref` param, POST `/v1/public/affiliates/click` once per page load via the shop proxy (landingUrl = path + search without `ref`, utm_* params), then strip `ref` from the URL with `history.replaceState`. Must not block render; ignore errors.
4. Cart coupon box: an applied affiliate code shows as a separate chip "Referred by {displayName} ({code})" with remove (DELETE `/cart/affiliate-code`); coupon chips unchanged. Checkout summary shows the same line (no money).
5. Account nav: add "Affiliate" entry.
6. Tests: join form, tabs render with mocked data, link generator (path, full URL, foreign URL rejected), ref capture strips param, coupon box affiliate chip.

## Agent U2 — admin (owns `apps/admin/src/features/affiliates/**`, `apps/admin/src/routes/affiliates*` (file routes), `apps/admin/test/affiliates*`; small hook edits: `apps/admin/src/lib/nav.ts` (Marketing group, "Affiliates", icon from existing set, `anyOf: ['affiliates.view']`), order detail card for the affiliate line — post on the board)

Mockup: `plan/mockups/admin/affiliates.html` + `plan/mockups/admin/shared/page-affiliates.js`. **No Applications tab / reject flow** (C70: no approval). Settings tab → link to the settings page key `affiliates` (don't rebuild settings).

1. `/affiliates` list: toolbar search + status filter, DataTable (`className: 'num'` for money cols) with code, name/customer, status badge, rate (mark overridden), clicks 30d, orders 30d, pending, balance, paid. Row → detail.
2. `/affiliates/$id`: header + KeyValue (customer, website, joined, payout method + details: full when `affiliate_payouts.manage`, else masked), edit modal (rate override or "use default", suspend with reason / reactivate) gated by `affiliates.manage`; tabs Commissions (table with order link to `/orders/$id`) and Payouts.
3. `/affiliates/payouts`: tab "Due" (from `/affiliate-payouts/due`, shows balance + payout details, "Mark paid" modal: method, reference, note; sends `expectedAmountP`; handles 409 codes with clear messages) and "History". Gated by `affiliate_payouts.manage` (hide the nav/tab otherwise).
4. Order detail: affiliate line (code, attribution link/code, commission status + amount) when present.
5. Tests: list renders + filters, detail perms (masked vs full), mark-paid flow incl. 409 mismatch, nav visibility by permission.

# 15 — UI mockup gaps (step 6b, C60)

Step 6b restyled only UI that already exists to match `plan/mockups/`. The mockup elements below were **not built**, because
the feature, API or screen does not exist yet (owner rule, session 12: do not build unbuilt parts during a restyle).
When a later step builds one of these, design its UI from the named mockup file and reuse `@bdc/ui`
(tokens, `.a-*` classes, `PageHeader`, `StatTile`, `StatusBadge`, `SectionCard`, `TableWrap`, `Toolbar`, `EmptyState`,
`KeyValue`, `SplitPane`, `Banner`, `Icon`). The mockup's own page CSS (`plan/mockups/admin/shared/<group>.css`) can be
copied into a CSS module almost unchanged, because `@bdc/ui` aliases the bare token names (`--primary`, `--surface` …).

## Whole mockup pages with no app screen yet

Not in the admin menu until built. Mockup: `plan/mockups/admin/<page>.html` + `shared/page-<page>.js`.

| Mockup page | Belongs to |
|---|---|
| `tickets.html` | support tickets (later step) |
| `reviews.html` | reviews & Q&A (step 8) |
| `events.html` | event pages / page builder (P3) |
| `loyalty.html` | loyalty, referral & wallet (step 8) |
| `affiliates.html`, `plan/mockups/affiliate/` | affiliates + affiliate portal (step 7) |
| `campaigns.html` | notifications & campaigns |
| `customers.html`, `customer.html` | customers admin |
| `suppliers.html`, `purchase-orders.html`, `plan/mockups/supplier/` | suppliers, POs, supplier portal (step 7) |
| `reports.html` | reports (also feeds the dashboard) |
| `audit.html` | audit log (C18: not in P1) |

## Shell / dashboard (`admin-core.js`, `index.html`)

- Global search over orders, products and customers. Today Enter only searches products; there is no global search API.
- Notifications feed. The bell only shows the call-queue count.
- "View as" role switcher (a demo-only feature; not planned).
- Dashboard: revenue, orders, AOV and conversion KPIs with deltas, the date-range picker, the sales line chart, the orders-by-status donut, top products, traffic sources, recent orders, "Needs attention" alerts, the COD launch-mode banner, and ops tiles (pending, on hold, low stock, tickets, returns). These need a reports/dashboard API. Today only the call-queue tile is live.

## Catalog (`products.html`, `product-edit.html`, `categories.html`, `inventory.html`)

- Products list:
  - status/stock tabs with counts
  - row checkboxes + bulk bar (activate, draft, set category, delete)
  - SKU, Sold, Rating, Fulfilment, Flags and Wishlists columns
  - min/max price filter
  - header "Export CSV" button
- Product editor:
  - two-column layout with a sticky side column (status & publishing, home-feed pin/boost, readiness checklist, danger zone)
  - SEO card with preview
  - return-window card
  - "Save & publish"
- Categories: two-pane tree + inline editor (the app edits in a drawer).
- Inventory:
  - location filter
  - KPI tiles
  - "Needs attention" / "Out of stock" chips
  - reorder → PO
  - Purchase orders + Export buttons

## Orders (`orders.html`, `order.html`, `returns.html`)

- Orders list:
  - COD launch-mode notice
  - "Export all CSV"
  - row checkboxes + bulk bar (print invoices, book courier, mark packed, export)
  - tab counts (no counts API)
  - "Flagged" tab
  - separate Method / Courier / Zone / Source filters and the Source line
  - risk tooltip
- Order detail:
  - Edit order (before hand-off)
  - Refund button on the order
  - customer stats + ratio bar
  - linked guest orders
  - calls & notes panel
  - risk-flags panel
  - audit log with note/call entries
  - loyalty-points, wallet and VAT total rows
  - "free above" badge
  - split-shipment notice
  - tracking chip
  - shipment cards with inline form fields (the app keeps a table)
- Returns:
  - Picked-up and Window columns
  - photo grid (only "N attached" today)
  - return-window check
  - shipping-payer and refund-method radio cards
  - restock note
  - approval-needed banner + sticky action footer
- Call queue: no mockup page; it uses the orders-list row style.

## Marketing (`coupons.html`, `flash-sales.html`, `home-feed.html`)

- Coupons:
  - Auto-discount and Payment-method tabs
  - per-row Pause/Resume and Edit in the list
  - Flags column
  - auto-generate code button
  - exclusions tag picker
  - example calculator
- Flash sales:
  - card list with Live/Scheduled/Ended tabs + counts
  - countdown
  - sold progress bar
  - revenue on ended sales
  - End now / Duplicate
  - overlap warning
  - storefront preview
- Home & feed: category tiles, feed-weight sliders, special rows, pinned products, sample feed preview, page-level Save, BN title, gradient placeholder thumbs. Today only the carousel exists.

## People & partners / System

- SR approvals (`sr-approvals.html`):
  - approval cards with price-vs-list diff and "priced below list" alerts
  - shop-owes alerts
  - inline Approve/Reject (the app approves in a drawer)
  - Due collections + Recent decisions tabs
  - KPI tiles
  - tab counts
- B2B shops / dues (`b2b-shops.html`, `b2b-dues.html`):
  - shop detail with ageing and tabs
  - pending/confirmed collections split
  - ageing stack bar
  - "By SR" tab with per-SR share bar
  - CSV export
  - totals row
  - Oldest column
  - "awaiting confirm" line
  - Ledger button
- SR team (`sr-team.html`): KPI row, achieved-progress bar column, default-commission card, "Accruing" status.
- Delivery (`delivery.html`): couriers section (needs `GET /admin/couriers`).
- Staff (`staff.html`):
  - invite-by-email drawer with role cards and "above your level" locks
  - new-device alert list
  - session-timeout banner
  - "You" badge
  - Enable/Disable buttons
  - phone column
- Roles (`roles.html`): master-detail split with Toggle-all and role counts (roles still edit in a modal).
- Settings (`settings.html`):
  - payment-gateway cards
  - message templates
  - logo/announcement previews
  - sticky save bar (settings still save per key)

## Wording kept for tests (mockup differs)

Page titles stay as the app has them because unit tests and e2e select them: "Categories" (mockup: Categories & attributes), "SR sales" (SR approvals), "Buyer shops" (B2B shops), "Dues ageing" (B2B dues), "Delivery zones" (Delivery & couriers), "Roles" (Roles & permissions). The sidebar already uses the mockup labels.

## SR portal (`plan/mockups/sr/`)

- "Me" / performance tab and `#/perf` view: month chips, target ring, commission breakdown, by-month table, account card. The fifth tab is still Collect.
- Sign-in with OTP and the SR's first name in the top bar. The portal signs in with email + password, and the shell has no name.
- Sale detail:
  - "Edit and resubmit" for rejected sales
  - "Our list total" row
  - "% below list" flag on items
  - "Approved by / Delivered by" lines
- Home:
  - rejected-sale and awaiting-collection notes
  - "stock reserved" and "N shops owe" lines on the tiles
  - collected-at-sale vs due-collections split in the commission note
- In-app memo view (`#/memo`: EN/BN switch, print, WhatsApp). The app opens the API memo URL instead.
- New sale:
  - live "list total" row in the summary
  - "Other" collection method
- Shop detail:
  - "Total bought" stat
  - "Customer since" row
  - running balance column in the ledger
- Add shop: area suggestions.
- Collections: current-due hint under the amount.

## Storefront (`apps/shop`)

See `plan/swarm/ui-fidelity/shop-gaps.md` section 4 (NOT BUILT) for the storefront list. It also lists the items skipped until someone checks them in a browser (C5, H8, H10, K9, O5, P14, A9) and the lead's "no" answers: G3 header category select, C12 Clear-filters action, L3 6-box OTP, O8 checkout steps trail.

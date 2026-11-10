# 17 — Plan vs code gaps (audit 2026-11-10, session 17)

Read-only audit of docs 01–06, SR/partner decisions and doc 15 against the code, for roadmap steps 1–7 only (later phases, dropship, SMS/courier keys and security excluded). About 250 of 300 planned bullets are built. Rows below are what "done" steps skipped. Size S/M/L. Tick when built.

## A. Core flow holes (a tester hits these)

| # | Gap | Plan ref | Size |
|---|---|---|---|
| A1 ✅ | Admin order edit before hand-off (qty, address, items; `order_edits`) | 05:51, step 5 | L |
| A2 ✅ | Status notifications: only "placed" is sent (no processing / handed over / delivered / refund) | 03:90, R5 | M |
| A3 ✅ | Customer cannot cancel own order before hand-off (API + shop) | 05:41, 05:61 | M |
| A4 ✅ | Courier name + tracking link not shown to customer (order page, track page) | 02:90, 05:50 (S6) | S–M |
| A5 ✅ | Failed delivery / returned-to-sender: no restock, no coupon/flash reversal, no order state, no staff action | 05:44, 05:67 (Q61, Q90) | M |
| A6 ✅ | Admin customers screen (list, profile, orders, notes, block); `customers.*` perms unused | 06 module table, mockups | M–L |
| A7 ✅ | Static pages CMS (About, Policies, Contact, FAQ, privacy) + footer/menu editor; shop shows "being built" | 02:92, 06:19, Q40 | M |
| A8 | Return photo upload by customer (API accepts `mediaIds`, no customer upload, admin shows count only) | 05:60 | M |
| A9 | SR cannot edit + resubmit a rejected sale | R13, 15:150 | M |
| A10 | Admin dashboard / reports (step 8, listed for completeness) | 06:7-8 | L |

## B. Admin operations

| # | Gap | Plan ref | Size |
|---|---|---|---|
| B1 ✅ | Default role templates (Manager, Catalog Editor, Order Processor, Packer, Marketing, Support, Accountant): only Owner seeded | 06:62 | S |
| B2 | CSV export for orders, returns/refunds, inventory, suppliers/POs, B2B dues (`inventory.export` perm unused) | 06:43-60 | M |
| B3 | Orders bulk actions (select rows → print invoices, book courier); bulk invoice print | 06:9, 05:52 (S26) | M |
| B4 ✅ | Orders list filters: courier, zone, payment method, source | 06:9 | S |
| B5 | Order detail: staff notes, customer stats, linked guest orders | 15:65-77 | S |
| B6 | Notification template editor EN/BN (texts hard-coded) | 03:94 | M |
| B7 ✅ | Low-stock alerts (count endpoint exists, nothing shows it); inventory "reorder → PO" | 06:14, 15:48 | S–M |
| B8 | Home & feed admin: weight sliders, special rows, preview (weights only via generic settings form) | Q83, 15:104 | M |
| B9 | Settings: SEO defaults (site title, description, OG image) | 06:23 | S |
| B10 | SR approver sees no list price / below-list warning | R15 | M |
| B11 | B2B dues by SR tab + CSV; SR portal past months + commission status | R16, R18 | M |
| B12 | Flash sale admin extras: end now, duplicate, sold progress | 15:96-103 | M |
| B13 | Products list: bulk bar, tab counts, price filter, more columns | 15:36-47 | M |
| B14 | PO approve step (permission matrix has it, C73 does not) | 06:51 | S–M |
| B15 | SR memo link never expires (`memoTokenAt` unchecked); no PDF/image | R20, C38 | S |
| B16 ✅ | Category cascade delete: should archive products with orders, now throws | 03:28 (Q70) | S |
| B17 | Carousel link target picker (free-text URL today) | 02:60 | S |
| B18 | Return outcome "Exchanged" | 05:44 | M |

## C. Storefront / catalog polish

| # | Gap | Plan ref | Size |
|---|---|---|---|
| C1 ✅ | Share buttons, trust badges on product page | 02:87 (S10, S11) | S |
| C2 | Also-bought (auto) + manual related products | 02:87, 03:43 (S4) | M |
| C3 | Free-delivery badge on product card | 02:73 (Q12) | M |
| C4 | Flash row inside home feed (strip above feed exists) | 02:29 (Q18) | S |
| C5 | Cookie notice | 02:93 (Q40) | S |
| C6 | Loading skeletons (`loading.tsx`) | 02:94 | M |
| C7 ✅ | Product tags, warranty field, dimensions | 03:34, 03:39 (Q50) | S each |
| C8 ✅ | Scheduled publish (`publishedAt` not settable) | 03:41 | S |
| C9 | Search term + zero-result log (phase unclear, maybe step 8) | 03:61 | M |
| C10 | In-app notification inbox, web push (Q37 says v1, no roadmap step) | 03:92 | M each |
| C11 | Multiple phones per customer; velocity rule by device | 03:83, Q54 | S |

## Fixed in session 17

- ✅ rows above: batch 7d (commits e58cd0a, 79a0575), decisions C86–C91. A7 covers pages + footer list only (no menu editor). B7 covers the low-stock badge/tile only (no reorder → PO).

- `sold_count` written at order placed, reversed on cancel (C85).
- Indexes: `orders(placed_at)`, `orders(ship_phone)`, `stock_movements(ref_type, ref_id)`.

## Performance backlog (not plan gaps)

Storefront listing/feed recompute price + stock per request (add `min_price`/`stock` columns, bucket feed seeds); no Redis cache for category tree/home/facets; cart view runs ~10 sequential promo queries; API test suite is serial with full DB reset per test (~20 min).

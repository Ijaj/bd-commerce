# bd-commerce — Planning Docs

> Working name `bd-commerce`. Real brand name TBD (see Q1).
> Status: **Phase 0 — feature discovery.** Rounds 1–2 answered (Q1–Q84, S1–S36); decisions in doc 10. No code until the gates below are done.

General-purpose e-commerce for Bangladesh ("we sell any and everything").

## Surfaces

| # | Surface | When |
|---|---------|------|
| 1 | Storefront (web, desktop + mobile web) | v1 |
| 2 | Admin panel (web) | v1 |
| 3 | Backend / API (shared by all clients) | v1 |
| 4 | Android app | After web launch; PWA until then (Q5, S12) |
| 5 | iOS app | Later, after Android is complete |
| 6 | Supplier portal (small web area for dropship suppliers, Q88) | v1 |

## Planning gates (in order)

1. [x] Feature list drafted (docs 01–07)
2. [x] Open questions answered (doc 08)
3. [x] Flowcharts — animated: `flowcharts/index.html`, backup: `11-flowcharts.md` (generated from `flowcharts/flows.js` via `node flowcharts/to-md.mjs`; edit flows.js, never the md)
   Flowcharts: checkout, order lifecycle, return/refund, coupon evaluation, category management, RBAC, visitor tracking
4. [x] Data model draft (entities + relations, no code) — `12-data-model.md`
5. [x] Mockups: home (web + Android), category page, product page, cart, checkout, account, event page, key admin screens
6. [x] Tech stack decision (lightweight storefront + fast Android are hard requirements) — `13-tech-stack.md`
7. [ ] Phased roadmap / MVP cut
8. [ ] Start coding

## Docs

| File | What |
|------|------|
| [01-scope-and-surfaces.md](01-scope-and-surfaces.md) | Goals, constraints, Bangladesh context |
| [02-storefront.md](02-storefront.md) | Web + Android UI, home page, category layout options |
| [03-catalog-and-backend.md](03-catalog-and-backend.md) | Categories, products, search, random feed, HTML descriptions, visitor tracking |
| [04-promotions-coupons-events.md](04-promotions-coupons-events.md) | Coupons, discounts, flash sales, event pages |
| [05-orders-payments-delivery.md](05-orders-payments-delivery.md) | Cart, checkout, payments, couriers, returns |
| [06-admin-and-rbac.md](06-admin-and-rbac.md) | Admin modules, dynamic roles, permission matrix, analytics |
| [07-suggested-features.md](07-suggested-features.md) | My suggestions — you approve/reject each |
| [08-open-questions.md](08-open-questions.md) | Open questions (none open right now) |
| [09-baby-commerce-reuse.md](09-baby-commerce-reuse.md) | What to reuse / avoid from the old project |
| [10-decisions-log.md](10-decisions-log.md) | All answered questions and decisions |
| [11-flowcharts.md](11-flowcharts.md) | 9 flows (generated). Animated: [flowcharts/index.html](flowcharts/index.html) |

## Conventions

- `[USER]` = requirement stated by you. `[SUGGESTED]` = my proposal, not approved. `[DECIDED]` = you confirmed.
- Every open decision lives in doc 08 with an ID. Other docs link to it as `(Q#)`.
- Keep it simple: when two options are close, the simpler one wins unless you say otherwise.

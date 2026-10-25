# 14 — Roadmap [DECIDED]

Decided 2026-10-23 (R1–R25, Q118–Q120 in doc 10). Builders: owner + Claude (R3), thin testable slices. Launch when P1 is feature-complete and tested, no fixed date (R2). Soft launch (friends/family, limited ads, real COD orders) for a few weeks, then public (R4).

## P1 — COD-only launch

Build order (R24). Each slice ends with tests (Vitest + Playwright where it touches a user flow).

| # | Slice | Contents |
|---|---|---|
| 1 | Foundation **[DONE 2026-10-23]** | Monorepo (pnpm + Turbo), CI (self-hosted runner moved to 9, C20), Podman dev stack (Postgres, Redis, Garage, imgproxy), Prisma + migrations, NestJS skeleton + OpenAPI client gen, staff auth (sessions, 2FA, new-device alerts), RBAC, settings + feature flags, EN/BN + digit helpers, maintenance mode / announcement bar |
| 2 | Catalog **[DONE 2026-10-24]** | Categories tree + attributes (option editor), brands, products + variants, HTML descriptions, images pipeline, inventory + stock ledger, bulk import/export |
| 3 | Storefront browse | Home (carousel, featured categories, weighted feed), category/search + filters + availability filter, product page, up-coming products, wishlist, recently viewed + similar, SEO + link previews, PWA, customer accounts (phone/email + password, OTP verify) |
| 4 | Cart + checkout | Cart, guest + account COD checkout, guest OTP above ৳X, delivery zones + per-zone free threshold, orders + statuses, order SMS/email, guest order tracking |
| 5 | Order operations | Admin orders (filters, edits before hand-off, hold/cancel, split), call-confirmation queue, courier API (Steadfast + Pathao), invoices + labels (VAT/BIN), returns & refunds (manual payback, no wallet) |
| 6 | Promotions | Product discounts, coupons (full), flash sales + countdown |
| 6b | UI fidelity (C60) | Restyle admin (then portal, then shop check) to match `plan/mockups`: brand-D tokens + dark mode, shell (gradient top bar, dark sidebar with icons/groups), shared page components, per-page pass. Spec: `plan/swarm/brief-ui-fidelity.md` |
| 7 | Partner portal | `apps/portal` (Q118): suppliers + POs + receiving + dropship supplier section; **SR module** (sale forms, approvals, B2B shop list, due ledger + collections, memo, targets + commission on collected money); affiliates + dashboard |
| 8 | Growth in P1 | Loyalty points, referral, analytics + visitor tracking, reviews & Q&A, abandoned cart email |
| 9 | Hardening + soft launch | Monitoring (Uptime Kuma, GlitchTip, Beszel), backups + replica drills, performance pass on low-end phones, full Playwright run, production setup on owner PCs + self-hosted deploy runner (C20), soft launch |

Pre-coding: SR portal + admin B2B mockups, owner review (R25).

## P2 — Payments
Online payments (bKash, Nagad, SSLCommerz), advance payment rules (Q106–Q108, Q111), pre-orders (Q109). All already modelled; switched on by feature flags.

## P3 — Growth & retention
Events + block page builder, Google/Facebook login, store wallet (refunds/cashback to wallet), audit log, support tickets, FB Pixel + CAPI + GA, product feeds (FB/Google).

## P4 — Android app
Native Kotlin (Compose) app in `apps/android`: customer app, push notifications + campaigns (S19), in-app update prompt + deep links (S36).

## Backlog (after P4, unordered)
Back-in-stock / price-drop alerts (S5), WhatsApp/Messenger order button (S7), product compare (S8), delivery charge + ETA on product page (S9), COD fraud check with courier history + blacklist (S21), daily owner report (S30), Bangla search (Q30), off-site backups (S-T16), marketplace / multi-seller (Q2).

## Notes
- Not in P1, so handled manually at launch: refunds paid back by bKash/cash (no wallet), no audit log, complaints outside the system (no tickets), no ad pixels.

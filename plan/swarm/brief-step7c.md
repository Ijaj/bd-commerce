# Step 7c brief: affiliates (API)

Repo `/home/ijaj/webdev/bd-commerce` (pnpm 11 + Turbo, Node 24, TS 7, Biome). Decisions: Q78, Q89, C67–C70, **C81–C84** in `plan/10-decisions-log.md` (grep `| C6[7-9] \|| C70 \|| C8[1-4] `, don't read the whole file). Data model notes: `plan/12-data-model.md` §8. Dropship is deferred (C80): ignore it.

Board (append-only): `plan/swarm/BOARD-step7c.md`, `cat >> … <<'EOF'`, format `[agent HH:MM] msg`. Post: start, blockers, DONE + summary.

## Hard rules

- No `git add/commit/push/stash/checkout/reset`. Lead commits. Never revert files you don't own.
- Lead-only: `apps/api/prisma/**`, `apps/api/src/auth/permissions.ts`, `apps/api/src/settings/registry.ts`, root configs, `packages/api-client/**`, `apps/admin|shop|portal/**`. Need a change there → board, keep working.
- Don't run `pnpm api:gen` or `prisma migrate`. Don't start/stop the container stack, don't `pkill -f`, don't touch other processes. Don't start a dev API.
- **Tests: own DB + Redis db**: `TEST_DATABASE_URL=postgresql://bdc:bdc_dev@localhost:5432/bdc_test_a TEST_REDIS_DB=2 pnpm --filter @bdc/api test <file>` (DB exists; migrations apply via `test/global-setup.ts`). Before DONE also run `test/checkout.test.ts`, `test/cart*.test.ts`, `test/coupons*.test.ts` (whatever exists) since you touch those modules.
- Match style: read neighbours first (`src/purchasing/suppliers/*`, `src/promotions/coupons/*`, `src/cart/cart-coupons.service.ts`, `src/checkout/checkout.service.ts`, `src/scheduler/scheduler.service.ts`, `test/helpers.ts`, one existing test). Comments sparse, say why. Biome clean (`pnpm biome check --write <paths>`). Zod DTOs via nestjs-zod; **DTO class names globally unique**: prefix `Affiliate…`. Admin endpoints `@StaffAuth` + permission decorator; customer endpoints use the existing customer auth guard; `@NoStore()` on all non-public. Errors in `affiliates.errors.ts` with stable `code` strings.
- Money = integer paisa, rates = basis points. Rounding: `Math.round`. Max file ~300 lines; split services.
- Before DONE: `pnpm --filter @bdc/api typecheck`, tests green, biome clean. Report exact commands + results honestly.

## Done by lead (wave 0)

- Migration `20261107100000_affiliates` applied in dev. Read `schema.prisma` section "Affiliates": `Affiliate` (code `^[A-Z0-9]{4,16}$` CHECK, `commissionBp` null = default, `status` active|suspended, `payoutMethod` bkash|bank, `payoutDetailsEnc`), `AffiliateClick`, `AffiliateCommission` (unique `orderId`; status pending|approved|reversed|paid; CHECK paid ⇔ payoutId set), `AffiliatePayout` (method bkash|bank|cash, amount > 0). `Cart.affiliateCode`, `Order.affiliateId` + `affiliateAttribution` (link|code).
- Perms: `affiliates.view` (admin GETs), `affiliates.manage` (PATCH affiliate), `affiliate_payouts.manage` (full payout details, record payouts, payout lists).
- Setting `affiliates` = `{enabled, defaultCommissionBp: 500, minPayoutP: 50000, clickWindowDays: 30}` (read via SettingsService like other modules).
- Env `AFFILIATE_PAYOUT_KEY` (64 hex) in `src/config/env.ts`; seal/open with `encrypt`/`decrypt` from `src/auth/crypto.ts`.
- Empty `src/affiliates/affiliates.module.ts`, wired in `app.module.ts`. Fill it.

## Agent A — affiliates API (owns `src/affiliates/**`, `test/affiliates*.test.ts`; may make **small hook edits** in `src/cart/**`, `src/checkout/**`, `src/scheduler/**`, `src/promotions/coupons/**`, `src/orders-admin/**` (detail DTO only), `src/config/env.ts` (one scheduler env var), `src/cli/**` — post each hook edit on the board)

### Rules (from decisions)
- Join: any logged-in customer, active at once (C70). Program off (`enabled=false`) → join 409 `AFFILIATE_PROGRAM_OFF`, clicks and codes ignored; existing dashboards still readable.
- Code: optional requested code (upper-cased, `^[A-Z0-9]{4,16}$`), else derived from displayName (letters/digits, upper, 4–10 chars, add digits until unique). Must not equal an existing coupon code / bulk coupon code (case-insensitive) → 409 `AFFILIATE_CODE_TAKEN`. Also add the reverse check in coupon create/update and bulk code generation: a coupon code equal to an affiliate code → their existing "code taken" error.
- Suspended affiliate: clicks ignored, code not accepted, no new attribution; existing commissions keep running; payouts still allowed.
- Attribution at order placement (C81, C82, Q89): `cart.affiliateCode` of an active affiliate → `code`; else the **latest** click for the order's `visitorId` within `clickWindowDays` of an active affiliate → `link`. Guest orders count (C84).
- Self-referral (C69) → no attribution at all: buyer `customerId` = affiliate's customer; or normalized ship/guest phone = affiliate customer's phone; or ship address matches one of the affiliate customer's saved addresses (same upazila + `line` equal after lower-case and whitespace collapse).
- At placement (same tx as order insert) create `AffiliateCommission` status `pending`: `commissionBp` = affiliate.commissionBp ?? default; `baseP` = Σ lines (`lineTotalP − discountP`) (excludes delivery, C68; check in `checkout.service.ts`/`returns.util.ts` that `lineTotalP` is before `discountP`); `amountP = round(baseP × bp / 10000)`.
- Scheduler job `affiliate-commissions` (add to `scheduler.service.ts` like the others, env `SCHEDULER_AFFILIATE_MIN` default 60) + CLI `approve-affiliate-commissions` running the same function:
  - pending + order `cancelled` (or any terminal not-delivered status; check `OrderStatus` enum) → `reversed`, reason `order_cancelled`.
  - pending + order `deliveredAt` set: `availableAt` = deliveredAt + max over lines of (`returnWindowDays` ?? setting `returns.windowDays`) days (store it); when `now ≥ availableAt`: final base = Σ round((lineTotalP − discountP) × keptQty / qty), keptQty = qty − qtyCancelled − qtyReturned; amount recomputed with the snapshot bp; amount 0 → `reversed` reason `nothing_kept`, else `approved` + `approvedAt`. Also block open returns: if the order has a return not yet finished (check Return statuses) wait.
  - Idempotent, batch 500, safe to run twice (row-level `FOR UPDATE SKIP LOCKED` or status-guarded `updateMany`).

### Endpoints
Public (`/v1/public`):
1. `POST /affiliates/click {code, landingUrl (≤ 500, path or same-site URL), utm?: {source?,medium?,campaign?}}` → 204 always (no code enumeration). Visitor id = `bdc_vid` cookie (see how cart reads it); no visitor → ignore. Skip insert if the visitor's latest click is the same affiliate within 30 min. Redis rate limit 60/min per IP (silently drop).

Cart (where the coupon box lives):
2. Coupon apply: if the code is not a coupon but is an active affiliate's code → set `cart.affiliateCode` (replaces any previous), success. Logged-in customer = that affiliate → 422 `AFFILIATE_SELF`. Does not count toward the coupon limit (C81). Cart response gains `affiliate: {code, displayName} | null` (null when code no longer active).
3. `DELETE /cart/affiliate-code` (same base path as the coupon routes) → cart.
4. Checkout quote/place response: include `affiliate: {code, displayName} | null` if a typed code applies (links stay invisible).

Customer (`/v1/customer/affiliate`, customer auth):
5. `GET /` → `AffiliateMe` `{joined:false}` or `{joined:true, id, code, displayName, website, status, commissionBp (effective), payoutMethod, payoutDetailsMasked (e.g. bkash `017•••••566`, bank `…1234`), clickWindowDays, minPayoutP, programEnabled}`.
6. `POST /join {displayName (2..80), website? (url), code?}` → AffiliateMe. Already joined → 409 `AFFILIATE_ALREADY_JOINED`.
7. `PATCH / {displayName?, website?}`.
8. `PUT /payout-details` body discriminated on `method`: `{method:'bkash', bkashNumber (BD mobile, normalise), holderName}` | `{method:'bank', bankName, branch, accountNo (6..20 digits), accountName}` → AffiliateMe (masked only, never the full value back).
9. `GET /stats?days=30 (7..90)` → `{days:[{date YYYY-MM-DD (Asia/Dhaka), clicks, orders}], totals:{clicks, orders, conversionBp, pendingP, balanceP (approved unpaid), paidP, reversedCount}}`.
10. `GET /commissions?status&page&pageSize` → `{items:[{id, placedAt, itemCount, firstItemTitle, attribution, baseP, commissionBp, amountP, status, availableAt, reverseReason}], total}` newest first. **No buyer identity, no order number.**
11. `GET /payouts?page` → `{items:[{id, period, amountP, method, reference, paidAt}], total}`.

Admin (`/v1/admin`, GET = `affiliates.view`):
12. `GET /affiliates?q (code/displayName/customer phone/email)&status&page&pageSize` → `{items:[{id, code, displayName, customer:{id,name,phone,email}, status, commissionBp (effective), rateOverridden, clicks30, orders30, pendingP, balanceP, paidP, createdAt}], total}`.
13. `GET /affiliates/:id` → row fields + website, suspendedAt, suspendedReason, payoutMethod, `payoutDetails` (full object only with `affiliate_payouts.manage`, else masked string) .
14. `PATCH /affiliates/:id` (`affiliates.manage`) `{commissionBp?: number|null, status?: 'active'|'suspended', suspendedReason? (required when suspending)}`. Rate change affects new orders only.
15. `GET /affiliates/:id/commissions?status&page` → like 10 plus `order:{id, orderNo}`.
16. `GET /affiliate-payouts/due` (`affiliate_payouts.manage`) → affiliates with balance ≥ `minPayoutP`: `[{affiliateId, code, displayName, balanceP, commissionCount, payoutMethod, payoutDetails (full), hasPayoutDetails}]`.
17. `POST /affiliates/:id/payouts` (`affiliate_payouts.manage`) `{method: bkash|bank|cash, reference (2..100), note?, expectedAmountP}` → in one tx lock approved unpaid commissions, sum must equal `expectedAmountP` (else 409 `AFFILIATE_PAYOUT_CHANGED`), sum < minPayoutP → 409 `AFFILIATE_BELOW_MIN`, 0 → 409 `AFFILIATE_NOTHING_DUE`; create payout (period = YYYY-MM Asia/Dhaka of now, paidById = staff), set commissions `paid` + payoutId.
18. `GET /affiliate-payouts?affiliateId&page` (`affiliate_payouts.manage`) → `{items:[{id, affiliate:{id,code,displayName}, period, amountP, method, reference, note, paidBy:{id,name}, paidAt}], total}`.
19. Admin order detail: add `affiliate: {id, code, displayName, attribution, commission:{status, amountP}} | null`.

### Tests (`test/affiliates*.test.ts`)
Join + code rules (derived, requested, taken by coupon, coupon refused when equal to affiliate code), program off, click dedupe + attribution by last click, typed code beats link, suspended ignored, self-referral (same customer, same phone, same address), guest order attributed, commission base excludes delivery and includes discounts, scheduler: cancel → reversed, delivered + window → approved with kept qty, partial return lowers amount, all returned → reversed; payout flow (due list min, expectedAmount mismatch, below min, success marks paid, CHECK), payout details masked for customer and for view-only staff, permissions 403s.

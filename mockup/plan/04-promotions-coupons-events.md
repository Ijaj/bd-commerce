# 04 — Promotions, Coupons, Events

> [DECIDED] "Very detailed coupon and description system" = coupons + **discount** system (Q41). **Everything below is v1** (Q45).

## Coupons

**Discount types**
- Percentage off (with max discount cap, e.g. 20% up to ৳500)
- Fixed amount off
- Free delivery (all zones or specific zones)
- Buy X get Y (same or different product; free or % off)
- Tiered (spend ৳2000 → ৳200 off, spend ৳5000 → ৳600 off)
- Bundle price (buy these together for ৳X)

**Scope**
- Whole order / specific products / categories (incl. descendants) / brands / event products
- Exclusions (products, categories, brands)

**Conditions**
- Min order amount, min quantity
- Valid date/time window
- Customer segment: everyone, first order, specific customers, inactive for N days (loyalty tier dropped — no tiers in v1, Q93 [DECIDED])
- **Payment method** (e.g. extra 10% with bKash) (Q42)
- Delivery zone
- Platform: web / app / both

**Limits**
- Total uses, per customer, per phone, per device/visitor ID
- Budget cap (stop after ৳X total discount)

**Mechanics**
- Code-based or auto-applied
- Single shared code or bulk unique codes
- **Stacking per coupon** (Q43): each coupon has toggles — stacks with sale/event price? stacks with other coupons? stacks with loyalty points?
- Public (shown on product page / Offers / collectable) or hidden
- **Collect-coupon wallet** (Q44): customers save coupons to their account; checkout suggests the best applicable one
- Customer-facing terms text on every coupon
- Reports: uses, revenue generated, discount given, top users

## Product-level discounts

- Sale price with start/end per product/variant.
- **Flash sales** (Q46): time window + limited quantity + per-customer limit, countdown timer, shown in feed rows and Offers tab.

## Events [USER + DECIDED]

- Own separate pages, built with a **block builder** (Q47). Blocks:
  - Hero banner / video
  - Countdown timer
  - Coupon block (collect/copy)
  - Product grid (hand-picked, by category, or by rule)
  - Category tiles
  - Brand strip
  - Rich text / HTML (sanitized, same rules as product descriptions)
  - Flash-sale slots with time windows
- Event fields: name, slug, start/end, pre-event teaser, theme colors, event prices, active.
- **Only one event active at a time** (Q48). Scheduling a second event that overlaps is blocked.
- **Event prices apply everywhere** on the site during the event (Q49).
- Active event appears in carousel (if admin adds a slide), feed banner rows, and the Offers tab.

## Other promotion tools [DECIDED v1]

- **Referral program** (S14): new customer gets a coupon on signup; referrer gets a coupon after the friend's first delivered order. Amounts in admin (Q77).
- **Loyalty points** (S15): earn rate, point value, expiry, min redeem, max % of order all admin-configurable; credited after delivery + return window (Q76).
- **Affiliate / influencer codes** (S20): % commission per order, counted after return window, paid monthly by staff via bKash/bank; affiliates have a self-service dashboard (clicks, orders, earnings) (Q78). Attribution: 30-day link click; code at checkout wins (Q89).
- **Store wallet** — refunds and cashback credited here (Q59b); spend only, no cash-out (Q79).
- Product feeds for FB/Google catalog ads (S18).

## Price evaluation order (draft — for the flowchart stage)

```
base price → sale price / flash price / event price (best one wins)
→ auto-applied discounts → coupon(s) per stacking rules
→ loyalty points → store wallet → delivery charge (free-delivery coupons apply here)
```

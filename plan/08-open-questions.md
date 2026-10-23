# 08 — Open Questions

Round 1 (Q1–Q69, S1–S36) is fully answered → see [10-decisions-log.md](10-decisions-log.md).

Round 2 (Q70–Q84) also answered → doc 10.

Round 3 (Q85–Q90) also answered → doc 10. **No open questions right now.**

## Round 3 (answered, kept for reference)

- **Q85** Order split into several shipments (warehouse + suppliers): customer pays **one** delivery charge per order, or one per shipment?
- **Q86** Online payment timeout: how long an "Awaiting payment" order keeps stock reserved before auto-cancel? (Suggested 30 min, admin setting.)
- **Q87** Return shipping cost: customer pays, we pay, or depends on reason (our fault = we pay)?
- **Q88** Dropship: how do suppliers receive orders (email / supplier portal login / staff calls them)? Who books the courier for direct-to-customer shipments (our courier account with pickup at supplier, or supplier's own)?
- **Q89** Affiliate attribution: link-click window (suggested 30 days); affiliate code at checkout overrides link?
- **Q90** On cancel / payment timeout / failed delivery: restore coupon usage, points and wallet? (Suggested yes.)

## Round 2 (answered, kept for reference)

- **Q70 ★** Deleting products that already have orders (Q23 option b): hard delete is impossible without breaking order history. Archive them instead (hidden everywhere, kept for orders/reports)?
- **Q71** Refund approval threshold ৳X (Q69)? Who approves (role)?
- **Q72** Which couriers first (Pathao, Steadfast, RedX, Paperfly, …)?
- **Q73 ★** Category delete dialog (Q23): when moving, move everything to one target category, or let admin pick a target per sub-category?
- **Q74** Which payment aggregator: SSLCommerz, aamarPay, ShurjoPay, or decide later by fees?
- **Q75** SMS provider for OTP + order SMS (decide later by price?)
- **Q76** Loyalty points rules: earn rate (e.g. 1 point per ৳100), point value, expiry, can points combine with coupons?
- **Q77** Referral reward: what do referrer and new customer each get, and when (after first delivered order)?
- **Q78** Affiliate commission: % per order or fixed? Paid how (bKash/bank), how often? Do affiliates get their own dashboard?
- **Q79** Store wallet (from refunds/cashback): can customers withdraw it, or only spend it?
- **Q80** Pre-order + COD allowed, or pre-orders must be prepaid / partly prepaid?
- **Q81** Guest checkout + no OTP: guest phone numbers are unverified. Is velocity flagging enough, or require OTP for guest COD orders above ৳X?
- **Q82** Dropship flow: supplier ships directly to the customer, or to our warehouse first and we ship?
- **Q83** Weighted feed: should admin control the weights (sliders in settings), or fixed rules?
- **Q84** Support tickets (S29): channels — web form only, or also email-in / phone call logging?

## Round 4 — raised by data model (all answered, see doc 10)
- **Q91** Accounts: separate customers / staff / supplier_users tables, or one users table?
- **Q92** Split shipments + one delivery charge: which shipment's COD collects it?
- **Q93** Loyalty tiers (coupon segment "loyalty tier") in v1?
- **Q94** Link guest orders to an account that later signs up with the same phone?
- **Q95** VAT: inclusive/exclusive, one rate or per category?

## Round 5 — raised by mockups (answered, see doc 10)
- **Q103** Brand: A Trust (green+saffron), B Deal (orange/red), or C Modern calm (indigo+teal)? Compare via switcher in `plan/mockups/`.
- **Q104** Bangla UI text (non-price): English digits ("24 ঘণ্টায়") or Bangla digits ("২৪ ঘণ্টায়")?
- **Q105** COD advance rule when order already has free delivery: advance = normal zone charge, a fixed ৳ amount, or a % of order?
- **Q111** Advance payment: several triggers → highest % or add them? → **answered: add (capped 100%)**, see doc 10
- **Q112** Admin panel language: EN only or EN + BN? → **answered: EN only**, see doc 10

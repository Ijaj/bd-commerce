# 05 — Cart, Checkout, Payments, Delivery, Returns

Flowcharts come next (after round-2 questions in doc 08).

## Cart

- Works for guests (visitor ID) and logged-in users; merged on login.
- Shows: item, variant, price changes since added, stock warnings, coupon field + wallet suggestions, delivery charge, total.
- Abandoned cart reminders by **email only** (S16).

## Checkout

- One page: address → delivery → payment → review → place order.
- Guest checkout allowed (Q34). Guest COD orders above admin-set ৳X must verify phone by SMS OTP (Q81).
- Address picker: Division → District → Upazila/Thana → Area + full address + phone. Saved addresses for accounts.
- Order notes field.
- One delivery charge per order even if split into several shipments (Q85).
- Online payments: order waits "Awaiting payment" 30 min (admin setting), then auto-cancels; coupon use, points, wallet restored (Q86, Q90).

## Delivery charge [DECIDED] (Q50)

- Base charge by zone (Inside Dhaka / Dhaka suburbs / Outside Dhaka — zones editable in admin).
- Extra per kg above a base weight.
- Free delivery above ৳X (admin setting; free-delivery coupons too).
- Per-product override (fixed charge or free delivery).
- No own riders, no pickup points (Q57/58).

## Payments [DECIDED] (Q51)

- COD, bKash (direct merchant API), Nagad (direct), one aggregator for cards/others (picked later by fees, Q74).
- **COD partial advance by rules** (Q52): admin defines rules (order total > ৳X, flagged by velocity rules, specific categories) → customer pays delivery charge (or set amount) in advance via bKash/Nagad/gateway.
- Payment-method discounts (Q42).
- Payment states: pending, paid, partially paid, failed, refunded, partially refunded.
- Check BD Digital Commerce guideline rules on holding advance payments.

## Order lifecycle [DECIDED basis]

```
Placed ──► Processing ──► Packed ──► Handed to courier ──► (courier tracking link) ──► Delivered ──► Completed (after 7-day return window)
  │            │
  │            └─ staff may call (optional) ──► On hold / Cancelled (blocked) or continue  (Q53)
  ├─ Cancelled by customer (before handed to courier)
  └─ Flagged by velocity rule ──► needs staff review (Q54)
Side flows: Failed delivery / Returned to sender · Return requested → Received → Refunded / Exchanged
```

- **No mandatory confirmation** (Q53): orders go straight to processing. Staff can call at their discretion, then block (cancel/hold) or continue.
- **Fraud v1: velocity rules only** (Q54) — e.g. >N orders from same phone/device/IP in X hours → flag. Courier success-rate lookup + blacklist later (S21).
- **Split shipments** (Q55): one order → several shipments (e.g. warehouse parcel + supplier parcel), each with own courier + tracking.
- Our tracking ends at hand-off; then show courier name + tracking ID/link (S6 note).
- [DECIDED] Staff can edit orders before hand-off (qty, address, add/remove items): permission-gated, audit-logged, customer notified.
- VAT invoice (BIN) + printable shipping labels, bulk print (S26).

## Couriers [DECIDED] (Q56)

- Multiple couriers via API; staff picks courier per shipment. Auto booking, consignment ID, status sync until delivered/returned.
- First couriers: **Steadfast + Pathao** (Q72).

## Returns & refunds [DECIDED]

- 7-day window by default, overridable per category/product (Q59).
- Return reasons, photo proof, customer can cancel before hand-off.
- Return shipping: we pay if our fault, customer pays for change of mind (Q87).
- Refund to original payment method or store wallet credit (Q59b). COD refunds → wallet or bKash/Nagad manual transfer.
- Refunds above ৳X need approval; threshold is an admin setting (Q69, Q71). Wallet credit is spend-only (Q79).

## Inventory & suppliers [DECIDED]

- One own warehouse + dropship suppliers (Q60). No multi-warehouse (S27: no).
- Stock reserved when order is placed; released on cancel/fail (Q61).
- **Supplier module** (Q62): supplier list, product ↔ supplier (+ supplier cost), dropship order forwarding via a **supplier portal** (Q88); per supplier: direct to customer (our courier account, pickup at supplier) or via our warehouse (Q82), purchase orders for own stock, receive stock against PO.
- Stock history log (who, what, why).

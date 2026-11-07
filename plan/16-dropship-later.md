# Dropship + supplier portal — deferred (C80)

Owner, 2026-11-07: dropship is for **after launch**. Run the business first, then decide. Nothing below is final.

## What already exists (kept, hidden)

- Schema: `products.fulfillment` (stock/dropship), `suppliers.ship_mode` (direct_to_customer / via_warehouse, default via_warehouse), `suppliers.pickup_address`, `shipments.source` (warehouse/supplier) + `supplier_id`, shipment statuses `awaiting_supplier`, `supplier_confirmed`, supplier ledger type `dropship` (delivered dropship order, C65).
- API: catalog accepts `fulfillment`; POs refuse dropship variants (`PO_DROPSHIP_VARIANT`); inventory/product list filter by fulfillment.
- UI: hidden behind `DROPSHIP_ENABLED = false` (`apps/admin/src/lib/features.ts`). Import/export omits the `fulfillment` column.
- Mockups: `plan/mockups/supplier/` (portal: orders to fulfil with 24 h confirm SLA, ready for pickup, history with payout, products & stock), `suppliers.html` dropship queue tab + portal-user drawer (`plan/15-ui-mockup-gaps.md`).

## Decided before deferral (still valid unless owner changes)

- C63 dropship is per variant; supplier updates stock in the portal; reserves like own stock. Default supplier = `variant_suppliers.is_default`.
- C65 payable added on delivered dropship order. C66 portal login = email + password + TOTP.
- Q82 per supplier: direct to customer or via our warehouse. Q88 portal (confirm stock, mark ready); direct parcels on **our** courier account, pickup at supplier.

## Early answers (session 16, preliminary)

- Supplier marks an item out of stock → **auto-cancel** the line and notify the customer.
- Portal accounts → **invite link** (one-time, set password, then 2FA); same link type for forgot password.

## Still open (ask the owner when dropship resumes)

1. Who books the courier when the supplier marks ready: auto-book default courier, or staff books from a queue?
2. Returned dropship item: reverse the supplier payable, keep it owed, or staff adjust by hand?
3. Confirm SLA (mockup: 24 h) and what happens when overdue (nudge email, staff queue, auto-cancel?).
4. Via-warehouse dropship: supplier delivers to our warehouse, staff mark arrived, then normal shipment? Merge with own-stock parcel?
5. What customer data the supplier sees (mockup: first name + initial + area; courier prints the label).
6. Supplier score / routing to another supplier (mockup note "may route future orders elsewhere").

# 12 — Data Model Draft (gate 4)

Entities + relations only. No code, no engine-specific types (tech stack is gate 6). Field lists show the important columns, not every column.

## 0. Conventions

- **Money**: integer poisha (৳1 = 100), columns end in `_p` (e.g. `price_p`). Never floats.
- **IDs**: internal integer/UUID PK `id` (picked with stack). Public-facing numbers are separate: `order_no` (e.g. `BD2610-000123`), `ticket_no`, `return_no`, `po_no`, `invoice_no`.
- **Timestamps**: every table has `created_at`, `updated_at`. Ledgers are append-only (no update, no delete).
- **Bilingual text** (EN/BN): written as `name{en,bn}` = two columns `name_en`, `name_bn`. BN optional, falls back to EN.
- **Seller-ready** (Q2): `sellers` table exists with one row (us). `seller_id` NOT NULL on products, order_items, shipments. Marketplace later = add rows + seller portal, no migration of old data.
- **Delete policy**: hard delete by default. Exceptions: products with orders → `status=archived` (Q70); staff/customers → `disabled_at` (never deleted, referenced by history). Orders, payments, ledgers, audit log: never deleted.
- **Snapshots**: orders copy names, prices, addresses, discount rules at placement. Later edits to catalog/coupons never change old orders.
- `→ X` = foreign key to X. `[enum: a/b/c]` = allowed values. `json` = flexible config blob.

---

## 1. Accounts & identity

**customers** — `id, name, phone (unique, nullable), phone_verified_at, email (unique, nullable), email_verified_at, password_hash (nullable), lang [en/bn], referral_code (unique), referred_by → customers, loyalty_points_balance (cache), wallet_balance_p (cache), is_flagged (risky: many returns / damage history / fraud → advance required, Q106), disabled_at, last_login_at`
- At least one of phone/email required.
- **customer_social_logins** — `customer_id →, provider [google/facebook], provider_user_id, email`
- **customer_addresses** — `customer_id →, label, name, phone, division_id →, district_id →, upazila_id →, area_id → (nullable), line, landmark, is_default`
- **customer_sessions** — `customer_id →, token_hash, device_id →, ip, user_agent, expires_at, revoked_at`
- **otp_codes** — `purpose [signup/reset/guest_cod/phone_change], phone, code_hash, attempts, expires_at, used_at, ip` (Q33b, Q81)

**staff** — `id, name, email (unique), phone, password_hash, totp_secret (encrypted), totp_enabled_at, disabled_at, last_login_at, session_timeout_min (nullable → setting)` (Q68)
- **staff_sessions** — `staff_id →, token_hash, ip, user_agent, last_seen_at, expires_at, revoked_at`
- **staff_known_devices** — `staff_id →, fingerprint_hash, first_seen_at, last_seen_at` (new-device alert when unknown)

**supplier_users** (portal, Q88) — `supplier_id →, name, phone, email, password_hash, disabled_at` + own sessions table.

**affiliates** — see §8. Affiliate dashboard login = customer account with an affiliate profile.

> [DECIDED Q91] customers / staff / supplier_users are **separate** account tables. Staff who shop use a normal customer account.
> [DECIDED Q94] Guest orders auto-link to an account once the same phone is verified by OTP (sets `orders.customer_id`, logged in audit_log).

## 2. RBAC & audit

- **permissions** — `key (e.g. orders.edit, refunds.approve_high, roles.manage), group, description` (seeded by code, not editable)
- **roles** — `name, description, is_system (Owner can't be deleted)`
- **role_permissions** — `role_id →, permission_id →`
- **staff_roles** — `staff_id →, role_id →` (many roles per staff, permissions = union, Q64)
- Rule (app logic, not schema): a staff member can only grant permissions they hold (Q65).

**audit_log** (S25) — `actor_type [staff/customer/supplier_user/system], actor_id, action (e.g. order.edit), entity_type, entity_id, before json, after json, ip, user_agent, at`. Append-only. Covers order edits, refunds, role changes, price changes, settings changes.

## 3. Catalog

**sellers** — `name, status` (one row now)

**brands** — `name{en,bn}, slug, logo_media_id →, active`

**categories** — `parent_id → categories (null = main), level [1–4], path (materialized, e.g. /3/17/42/), name{en,bn}, slug, image_media_id → (required at level 1, Q20), chip_color (Q15), sort, is_active, show_on_home, return_window_days (nullable override, Q59), seo_title, seo_description`
- Max depth 4 (Q19). `path` makes "category + all descendants" one prefix query.
- Delete (Q23/Q73) is a transaction, not a schema state: either move children + products to target, or cascade (products with orders → archived, others hard-deleted). Logged in audit_log.

**category_attributes** (Q25) — `category_id →, key, name{en,bn}, type [text/number/select/multiselect/boolean], unit, is_filterable, is_required, sort`
- **attribute_options** — `attribute_id →, value{en,bn}, sort`
- Inherited: a product sees attributes of its categories and all their ancestors.

**products** — `seller_id →, brand_id →, primary_category_id →, title{en,bn}, slug, short_description{en,bn}, description_html{en,bn} (sanitized, Q28), youtube_url (Q26), status [draft/active/archived], archived_at, fulfillment [stock/dropship], has_variants, weight_g (default), delivery_charge_override_p (nullable, Q50), return_window_days (nullable override), is_preorder, preorder_expected_date, advance_percent (nullable; set = product requires advance X%, also used for dropship items — Q106), vat_rate_bp (nullable override, unused in v1 — Q95), is_pinned, pin_boost, rating_avg, rating_count, sold_count, view_count (caches), seo_title, seo_description, published_at`
- **product_categories** (Q21/Q22) — `product_id →, category_id →` (any level; primary also listed here)
- **product_attribute_values** — `product_id →, attribute_id →, value_text / value_number / option_id →` (multiselect = several rows)
- **product_options** (Q24, max 2) — `product_id →, position [1/2], name{en,bn}` (e.g. Color, Size)
- **product_option_values** — `option_id →, value{en,bn}, swatch_hex, sort`
- **product_images** — `product_id →, variant_id → (nullable = shared), media_id →, sort, alt`
- **product_recommendations** (S4, computed nightly) — `product_id →, related_product_id →, kind [also_bought/similar], score`

**variants** — every product has ≥1 variant; a simple product has one default variant (hidden in UI). Price/stock always live here.
`product_id →, sku (unique), barcode, option_value_1_id → (nullable), option_value_2_id → (nullable), price_p, compare_at_p (old price shown struck-through), sale_price_p, sale_starts_at, sale_ends_at, cost_p (last cost), weight_g (nullable → product), is_active, sort`
- Unique (product_id, option_value_1_id, option_value_2_id).

**media** (S31) — `storage_key, mime, width, height, bytes, alt, uploaded_by, renditions json (webp/avif sizes)`. Reused by products, categories, CMS, reviews, tickets.

### Inventory (one warehouse, Q60)
- **inventory** — `variant_id → (1:1), on_hand, reserved, low_stock_threshold`. Available = on_hand − reserved.
- **stock_movements** (ledger) — `variant_id →, qty_delta, reserved_delta, reason [po_receive/order_reserve/order_release/ship/return_restock/adjust/import], ref_type, ref_id, staff_id →, note, at`
- Reserve on order placed, release on cancel/timeout (Q61, Q86). Dropship variants: no on_hand; stock confirmed by supplier per order.

## 4. Suppliers & purchasing (Q62, Q82, Q88)

- **suppliers** — `name, contact_name, phone, email, address, pickup_area_id →, ship_mode [direct_to_customer/via_warehouse], payment_terms, notes, is_active`
- **variant_suppliers** — `variant_id →, supplier_id →, supplier_sku, cost_p, lead_time_days, is_default`
- **purchase_orders** — `po_no, supplier_id →, status [draft/sent/partially_received/received/cancelled], expected_at, subtotal_p, notes, created_by →staff`
- **purchase_order_items** — `po_id →, variant_id →, qty_ordered, qty_received, unit_cost_p`
- Receiving writes `stock_movements (po_receive)`.
- Dropship order forwarding = a shipment with `source=supplier` (§6); supplier portal users see only shipments of their supplier.

## 5. Pricing & promotions

### Price sources (pricing-engine flowchart)
Unit price = best (lowest) of: variant `price_p` / active `sale_price_p` / active flash price / active event price. Then discounts → coupons → points → wallet → delivery.

**flash_sales** (Q46) — `name{en,bn}, starts_at, ends_at, is_active`
- **flash_sale_items** — `flash_sale_id →, variant_id →, flash_price_p, qty_limit, qty_sold, per_customer_limit, sort`

**events** (Q47–Q49) — `name{en,bn}, slug, teaser_starts_at, starts_at, ends_at, theme json (colors), status [draft/scheduled/live/ended], seo fields`
- No overlapping `[starts_at, ends_at]` among non-draft events (enforced on save, Q48).
- **event_prices** — `event_id →, variant_id →, price_p` (apply site-wide while live, Q49)
- **event_blocks** — `event_id →, type [hero/countdown/coupon/product_grid/category_tiles/brand_strip/rich_text/flash_slot], sort, config json, starts_at, ends_at (for flash slots)`

**coupons** (doc 04, all v1) —
- Identity: `name, kind [code/auto], code (nullable; null when bulk or auto), is_bulk, terms{en,bn}, visibility [public/hidden], is_collectable, status [draft/active/paused/expired]`
- Discount: `type [percent/fixed/free_delivery/bxgy/tiered/bundle], value (bp for %, poisha for fixed), max_discount_p, config json` (bxgy: buy qty/targets, get qty/targets, get % off; bundle: price_p)
- Conditions: `min_order_p, min_qty, starts_at, ends_at, segment [all/first_order/specific/inactive_days] (no loyalty_tier in v1, Q93), segment_param, payment_methods (set, Q42), platform [web/app/both]`
- Limits: `max_uses_total, max_per_customer, max_per_phone, max_per_device, budget_cap_p, uses_count (cache), discount_given_p (cache)`
- Stacking (Q43): `stacks_with_sale_price, stacks_with_other_coupons, stacks_with_points`
- Origin: `source [manual/referral_signup/referral_reward/system]`
- **coupon_targets** — `coupon_id →, target_type [product/category/brand/event], target_id, mode [include/exclude]` (category = incl. descendants)
- **coupon_zones** — `coupon_id →, zone_id →` (zone condition / free-delivery zones)
- **coupon_tiers** — `coupon_id →, min_spend_p, discount_p` (tiered)
- **coupon_customers** — `coupon_id →, customer_id →` (segment = specific, also referral coupons)
- **coupon_codes** (bulk unique) — `coupon_id →, code (unique), assigned_customer_id →, used_at`
- **coupon_wallet** (Q44) — `customer_id →, coupon_id →, collected_at` unique pair
- **coupon_redemptions** — `coupon_id →, coupon_code_id →, order_id →, customer_id →, phone, visitor_id, discount_p, status [applied/reversed], reversed_at` (Q90: cancel/timeout/failed delivery → reversed, use returns)

Payment-method discounts (extra 10% with bKash) = auto coupon with `payment_methods` condition. No separate table.

### Loyalty (S15, Q76)
- Settings hold earn rate, point value, expiry days, min redeem, max % of order.
- No loyalty tiers in v1 (Q93); flat earn rate. Add a `loyalty_tiers` table later if needed.
- **loyalty_ledger** — `customer_id →, points (+/−), type [earn/redeem/expire/reverse/adjust], order_id →, available_at (delivery + return window), expires_at, remaining (for FIFO expiry), staff_id → (adjust), note`
- Earn row created on delivery as pending; counts toward balance only after `available_at`.

### Store wallet (Q59b, Q79 — spend only)
- **wallet_ledger** — `customer_id →, amount_p (+/−), type [refund_credit/cashback/spend/reverse/adjust], order_id →, refund_id →, staff_id →, note, balance_after_p`

### Referrals (S14, Q77)
- **referrals** — `referrer_id → customers, referee_id → customers (unique), signup_coupon_id →, first_order_id →, reward_coupon_id →, status [signed_up/rewarded/void]`

## 6. Cart, orders, payments, shipments

**carts** — `customer_id → (nullable), visitor_id, platform, last_activity_at, abandoned_notified_at (S16), merged_into_id`
- **cart_items** — `cart_id →, variant_id →, qty, price_at_add_p, added_at`
- Guest cart by visitor_id; merged into customer cart on login.

**orders** —
- Who: `order_no, customer_id → (nullable = guest, Q34), guest_name, guest_phone, guest_email, visitor_id, platform [web/app], ip, user_agent`
- Ship-to snapshot: `ship_name, ship_phone, division/district/upazila/area ids + names, ship_line, landmark, zone_id →`
- Status: `status [pending_payment/processing/on_hold/partially_shipped/shipped/delivered/completed/cancelled], payment_status [unpaid/partially_paid/paid/partially_refunded/refunded/failed], payment_method_chosen, payment_deadline_at (online, Q86), is_preorder, cancel_reason, held_reason`
- Money: `subtotal_p (sum of unit prices × qty), auto_discount_p, coupon_discount_p, points_used, points_value_p, wallet_used_p, delivery_charge_p, delivery_discount_p, grand_total_p, advance_required_p (= delivery fee if not free + advance % — Q106/Q107; pre-order Q80), paid_p, refunded_p, cod_due_p`
- Attribution: `affiliate_id →, attribution [link/code], coupon_codes_text (display)`
- Checks: `guest_otp_verified_at (Q81), risk_score, completed_at (after return window), delivered_at, placed_at`

**order_items** — `order_id →, seller_id →, product_id →, variant_id →, supplier_id → (dropship), title_snapshot, sku, options_text, image_media_id, qty, qty_cancelled, qty_returned, unit_base_p, unit_price_p, price_source [base/sale/flash/event], price_source_id, weight_g, return_window_days, vat_rate_bp, line_total_p (after all allocations)`

**order_item_discounts** (per-line allocation, needed for partial refunds) — `order_item_id →, source [auto/coupon/points/wallet/delivery], source_id, amount_p`
- Order-level discounts are split across eligible lines pro rata by line value; rounding remainder goes to the largest line.

**order_status_history** — `order_id →, from_status, to_status, actor_type, actor_id, note, at`
**order_notes** — `order_id →, staff_id →, kind [note/call_log], body, call_outcome [continue/hold/cancel/no_answer]` (S22 optional call, Q53)
**order_risk_flags** — `order_id →, rule [phone_velocity/device_velocity/ip_velocity/...], detail json, cleared_by →staff, cleared_at` (Q54)
**order_edits** — `order_id →, staff_id →, before json, after json, customer_notified_at` (pre-handoff edits; also in audit_log)

**payments** — `order_id →, method [cod/bkash/nagad/gateway/wallet], purpose [full/advance/balance/delivery_charge], amount_p, status [initiated/success/failed/cancelled/expired], provider, provider_txn_id, provider_payload json, initiated_at, paid_at`
- **payment_webhooks** — `provider, event_id (unique), payload json, processed_at, error` (idempotency)
- COD collected = courier settlement marks `payments(cod).status=success` per shipment.

**couriers** (Q56, Q72) — `code [steadfast/pathao/...], name, is_active, config json (non-secret; API keys in secret store)`

**shipments** (Q55) — `order_id →, shipment_no, seller_id →, source [warehouse/supplier], supplier_id →, supplier_ship_mode, status [pending/awaiting_supplier/supplier_confirmed/ready/booked/handed_over/in_transit/delivered/failed/returning/returned], weight_g, cod_amount_p, delivery_charge_share_p (whole charge on first shipment sent, others 0 — Q92), courier_id →, consignment_id, tracking_url, packed_at, handed_at, delivered_at`
- **shipment_items** — `shipment_id →, order_item_id →, qty`
- **courier_bookings** — `shipment_id →, courier_id →, pickup [warehouse/supplier], request json, response json, consignment_id, status [requested/booked/failed/cancelled], attempt` (rebooking keeps history)
- **courier_status_events** — `booking_id →, raw_status, mapped_status, payload json, at` (sync until delivered/returned)
- **supplier_confirmations** (portal) — `shipment_id →, supplier_user_id →, action [confirm_stock/out_of_stock/mark_ready], note, at`

**invoices** (S26) — `order_id →, invoice_no (sequence), issued_at, vat_rate_bp, vat_total_p, bin_snapshot, pdf_media_id`. [DECIDED Q95] Prices are VAT-inclusive at one store rate (setting); invoice shows the VAT portion + BIN.

## 7. Returns & refunds (Q59, Q59b, Q69, Q71, Q87)

- **returns** — `return_no, order_id →, customer_id →, status [requested/approved/rejected/pickup_booked/received/inspected/closed], fault [ours/customer] (decides return shipping payer), return_shipping_p, pickup_booking_id → courier_bookings, staff_id →, reject_reason`
- **return_items** — `return_id →, order_item_id →, qty, reason [wrong_item/damaged/defective/not_as_described/change_of_mind/other], note, condition [resellable/damaged], restock`
- **return_media** — `return_id →, media_id →`
- **refunds** — `order_id →, return_id → (nullable: cancel refunds have none), amount_p, method [original/wallet], status [pending_approval/approved/rejected/processing/done/failed], needs_approval (amount > threshold setting), requested_by →staff, approved_by →staff, approved_at, provider_ref, done_at`
- **refund_items** — `refund_id →, order_item_id →, qty, amount_p` (amount derived from line allocations)
- On refund/cancel: wallet_ledger, loyalty_ledger (reverse), coupon_redemptions (reversed if whole order cancelled, Q90), affiliate_commissions (reversed), stock_movements (return_restock).

## 8. Affiliates (S20, Q78, Q89)

- **affiliates** — `customer_id → (unique), code (unique), commission_bp, status [pending/active/suspended], payout_method [bkash/bank], payout_details json (encrypted), approved_by →staff`
- **affiliate_clicks** — `affiliate_id →, visitor_id, landing_url, utm json, clicked_at` (valid 30 days)
- Order attribution on `orders.affiliate_id + attribution`; checkout code beats link.
- **affiliate_commissions** — `affiliate_id →, order_id → (unique), base_p, commission_bp, amount_p, status [pending/approved/reversed/paid], available_at (after return window), payout_id →`
- **affiliate_payouts** — `affiliate_id →, period (YYYY-MM), amount_p, method, reference, paid_by →staff, paid_at`

## 9. Delivery zones (Q50, Q85)

- BD geo master: **divisions**, **districts** (→division), **upazilas** (→district), **areas** (→upazila, optional, for courier-specific area lists) — all `name{en,bn}`, plus courier area codes in **courier_area_codes** `(courier_id →, area_id/upazila_id, external_code)`.
- **delivery_zones** — `name{en,bn} (e.g. Inside Dhaka / Dhaka suburbs / Outside Dhaka), base_charge_p, base_weight_g, extra_per_kg_p, eta_min_days, eta_max_days, free_above_p (per-zone free-delivery threshold: null = never free, 0 = always free — Q105), sort`
- **zone_locations** — `zone_id →, district_id / upazila_id / area_id` (most specific match wins)
- Product override: `products.delivery_charge_override_p`. One charge per order (Q85).

## 10. Customer engagement

- **wishlists** — `customer_id →, product_id →, variant_id → (nullable), added_at` (S2)
- **recently viewed** (S3) — read from visitor_events; optional cache **recent_views** `(visitor_id, product_id, viewed_at)` capped 50.
- **reviews** (Q35) — `product_id →, order_item_id → (unique, verified buyer), customer_id →, rating [1–5], body, status [visible/hidden], hidden_by →staff, staff_reply, replied_by →staff, replied_at`
- **review_media** — `review_id →, media_id →`
- **product_questions** (Q36) — `product_id →, customer_id →, body, status [visible/hidden]`
- **product_answers** — `question_id →, author_type [staff/customer], author_id, body, status`

## 11. Visitor tracking (Q31, Q32)

- **visitors** — `visitor_id (cookie/app install UUID), customer_id → (linked on login), first_seen_at, last_seen_at, first_utm json, first_referrer, device_type, os, browser, app_version`
- **visitor_sessions** — `visitor_id, started_at, ended_at, landing_url, utm json, referrer, ip, page_count`
- **visitor_events** — **partitioned by month, kept forever** — `event_id (UUID, also used as Pixel/CAPI dedup id), visitor_id, session_id, customer_id, type [page_view/product_view/category_view/search/add_to_cart/remove_from_cart/begin_checkout/purchase/...], url, product_id, variant_id, category_id, search_query, value_p, meta json, ip, user_agent, at`
- **pixel_dispatch_log** — `event_id, target [fb_capi/ga4/tiktok], status, response, at` (server-side forwarding, retry)

## 12. Notifications (Q37, S16, S19)

- **notification_templates** — `key (order_placed, otp, shipped, ...), channel [sms/email/inbox/push], lang [en/bn], subject, body (with {{vars}}), is_active`
- **notification_outbox** — `recipient_type [customer/guest/staff/supplier_user/affiliate], recipient_id, to_address (phone/email/token), channel, template_key, payload json, status [queued/sent/failed], provider, provider_msg_id, attempts, error, sent_at`
- **inbox_messages** — `customer_id →, title{en,bn}, body, link, read_at`
- **push_tokens** — `customer_id → / visitor_id, kind [webpush/fcm], token/endpoint json, last_used_at, revoked_at`
- **campaigns** — `name, channel [push/email/sms/inbox], audience json (segment rule), content json, scheduled_at, status, sent_count`
- SMS provider swappable (Q75): `settings.sms_provider` + adapter code; outbox stores which provider sent it.

## 13. Support tickets (S29, Q84)

- **tickets** — `ticket_no, customer_id → (nullable), guest_phone, order_id →, channel [form/phone], category, subject, status [open/pending_customer/resolved/closed], priority, assigned_staff_id →, created_by_staff_id → (phone-logged)`
- **ticket_messages** — `ticket_id →, author_type [customer/staff], author_id, body, is_internal, at`
- **ticket_attachments** — `message_id →, media_id →`

## 14. CMS & storefront config

- **carousel_slides** — `title, image_desktop_media_id →, image_mobile_media_id →, link_url, starts_at, ends_at, sort, is_active, lang [all/en/bn]`
- Home categories: `categories.show_on_home + sort` (Q13/Q14).
- **pages** — `slug, title{en,bn}, body_html{en,bn}, seo fields, is_published` (privacy policy, terms, about, return policy)
- **announcement** + **maintenance mode** + **trust badges** + **feed weights** (Q83) → settings.
- **menus** — `location [footer/top_bar], items json`

## 15. Settings & ops

- **settings** — `key, value json, updated_by →staff, updated_at`. Keys incl.: store info + BIN/VAT, default return window (7), payment timeout (30 min), guest COD OTP threshold, refund approval threshold, loyalty config, referral amounts, feed weights, sms/email provider, maintenance mode, announcement bar, cookie notice text, staff session timeout, high-price advance threshold ৳X + its %, risky-customer advance % (Q107/Q108), feature flags: `online_payments_enabled`, `advance_payments_enabled`, `preorders_enabled` (all off at COD-only launch — Q106b/Q109).
- ~~cod_advance_rules~~ (Q52) — **dropped by Q106**: advance is computed, not rule-table driven. Triggers: product `advance_percent` set, customer `is_flagged`, product unit price > setting ৳X. Amount = delivery fee (0 if free) + applicable %. If several triggers apply, add their %s together (Q111), capped at 100% of the item. Only active when `advance_payments_enabled`.
- **velocity_rules** (Q54) — `key [phone/device/ip], window_minutes, max_orders, action [flag/hold]`
- **import_jobs / export_jobs** (S24) — `kind, file_media_id, status, total_rows, ok_rows, error_rows, error_file_media_id, created_by →staff`
- **job_runs** (cron visibility: commissions approval, points activation, abandoned cart, feeds) — `job, started_at, finished_at, status, stats json`

---

## 16. Relation map (core)

```
customers 1─* customer_addresses        staff *─* roles *─* permissions
customers 1─* orders (nullable: guest)   staff 1─* audit_log (actor)
orders 1─* order_items ─* order_item_discounts
orders 1─* shipments 1─* shipment_items ─1 order_items
shipments 1─* courier_bookings 1─* courier_status_events
orders 1─* payments        orders 1─* refunds ─* refund_items
orders 1─* returns 1─* return_items ─1 order_items
products 1─* variants 1─1 inventory 1─* stock_movements
products *─* categories (product_categories)   categories ─ parent (4 levels)
categories 1─* category_attributes 1─* attribute_options
products 1─* product_options(≤2) 1─* product_option_values ─ variants
variants *─* suppliers (variant_suppliers)   suppliers 1─* purchase_orders 1─* po_items
suppliers 1─* supplier_users   shipments(source=supplier) ─1 suppliers
coupons 1─* coupon_targets/tiers/codes/zones/customers   coupons 1─* coupon_redemptions ─1 orders
customers 1─* coupon_wallet, loyalty_ledger, wallet_ledger, wishlists, reviews, tickets
events 1─* event_prices, event_blocks      flash_sales 1─* flash_sale_items ─1 variants
affiliates 1─* affiliate_clicks, affiliate_commissions ─1 orders, affiliate_payouts
visitors 1─* visitor_sessions 1─* visitor_events (monthly partitions)
delivery_zones 1─* zone_locations ─ districts/upazilas/areas ; orders ─1 delivery_zones
```

## 17. Questions raised by this model (all decided, see doc 10)

Q91 separate account tables · Q92 delivery charge on first shipment · Q93 no loyalty tiers v1 · Q94 auto-link guest orders after OTP · Q95 VAT-inclusive, one store rate.

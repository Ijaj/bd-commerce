# Admin mockups — shared contract (batch 3, 5 parallel agents)

Static HTML/CSS/JS mockups of the admin panel for a Bangladesh e-commerce shop (planning phase). Must work via file:// (no build, no fetch of local files, no ES modules, no CDN JS; Google Fonts OK; images = inline SVG/CSS/emoji). Desktop-first, usable down to 390px (sidebar → drawer, tables scroll horizontally inside `.a-table-wrap`). Light + dark mode. **Admin UI is English-only in mockups.** Prices `৳1,25,000` (lakh grouping). Charts = hand-written inline SVG (no libs).

## Hard file-ownership rules (agents run at the same time)
- Edit ONLY files you own (listed per agent below). Never edit anything outside `plan/mockups/admin/`, `plan/mockups/supplier/`, `plan/mockups/affiliate/` — another agent is changing the storefront `plan/mockups/shared/*` and `plan/mockups/index.html` right now. You may READ them.
- Shell agent (A) owns `admin/shared/admin-core.js` and `admin/shared/admin.css`. Others must not edit them; if a component is missing, build it in your own group CSS/JS file.
- Each other agent puts page CSS in its own `admin/shared/<group>.css` and page JS in `admin/shared/page-<name>.js`, and generates its own fake data inside its own JS (don't depend on other groups' data).
- Chrome DevTools MCP may be shared by several agents: always open your own tab with `new_page` and pass its `pageId` on every call; never close other tabs; keep checks short, jpeg q40 screenshots, few of them.

## Page skeleton (every admin page)
```html
<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Orders — ShopName Admin</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Noto+Sans+Bengali:wght@400;600&display=swap">
<link rel="stylesheet" href="../shared/brand-d.css">   <!-- final brand tokens (B style + C colours); fallback ../shared/brand-c.css if brand-d missing -->
<link rel="stylesheet" href="shared/admin.css">
<link rel="stylesheet" href="shared/<group>.css">
<script src="shared/admin-boot.js"></script>          <!-- owned by A: sets data-theme before paint from localStorage 'shop.theme' (light|dark|system) -->
</head><body>
<div id="app"></div>
<script src="shared/admin-core.js"></script>
<script src="shared/page-<name>.js"></script>
</body></html>
```
Use brand tokens only (`--primary --accent --bg --surface --surface-2 --text --muted --border --success --danger --sale` etc. — read `../shared/brand-c.css` for names). admin.css may define admin-only tokens (`--a-sidebar-bg`, `--warn`, `--info`) derived from those, in light and dark.

## JS API (A implements in admin-core.js; others call it)
- `Admin.renderPage({ active, title, crumbs:[[label,href],...], actions: html, body: html, onReady(root) })` — renders sidebar + topbar + page header (title, crumbs, actions) + body into `#app`.
- `Admin.modal.open(html, {title, size:'sm|md|lg', onClose})`, `Admin.modal.close()`
- `Admin.drawer.open(html, {title, width})`, `Admin.drawer.close()` (right-side panel)
- `Admin.toast(msg, type='ok|warn|danger|info')`
- `Admin.fmt.bdt(n)` → `৳1,25,000`; `Admin.fmt.date(d)`, `Admin.fmt.dt(d)`, `Admin.fmt.ago(d)`, `Admin.fmt.num(n)`
- `Admin.$(sel, root)`, `Admin.$$(sel, root)`, `Admin.esc(str)`
- `Admin.store.get(k, def)` / `Admin.store.set(k, v)` (localStorage, try/catch)
- `Admin.can(perm)` → bool for current demo role. Any element with `data-perm="perm.key"` is hidden (or `data-perm-mode="disable"` → disabled + tooltip "No permission") when the role lacks it. Re-applied after renderPage and via `Admin.applyPerms(root)` after late inserts.
- `Admin.icons.<name>` inline SVG strings: dashboard, orders, returns, tickets, products, categories, inventory, reviews, coupons, flash, event, home, loyalty, affiliate, campaign, customers, suppliers, po, delivery, reports, staff, roles, settings, audit, search, bell, user, plus, edit, trash, eye, filter, download, upload, check, x, chevron, more, phone, truck, warn, lock.
- `Admin.chart.line(points,{w,h})`, `Admin.chart.bars(items,{w,h})`, `Admin.chart.donut(items)` → SVG strings (simple).
- `Admin.on(event, fn)` / `Admin.emit(event, data)` — events: 'role', 'theme'.

## Topbar (A)
Logo "ShopName Admin", global search (orders/products/customers), "View as" demo role switcher (Owner, Manager, Order staff, Catalog editor, Support, Marketing — stored `admin.role`), notifications bell with dropdown, dark-mode toggle, staff menu (profile, 2FA, logout → login.html), "View store" link `../home.html`.

## Sidebar nav (A builds exactly this; `active` = key)
| key | label | href | perm |
|---|---|---|---|
| dashboard | Dashboard | index.html | dashboard.view |
| orders | Orders | orders.html | orders.view |
| returns | Returns & refunds | returns.html | returns.view |
| tickets | Support tickets | tickets.html | tickets.view |
| products | Products | products.html | products.view |
| categories | Categories & attributes | categories.html | categories.manage |
| inventory | Inventory | inventory.html | inventory.view |
| reviews | Reviews & Q&A | reviews.html | reviews.manage |
| coupons | Coupons & discounts | coupons.html | promos.manage |
| flash | Flash sales | flash-sales.html | promos.manage |
| events | Event pages | events.html | promos.manage |
| homefeed | Home & feed | home-feed.html | cms.manage |
| loyalty | Loyalty, referral & wallet | loyalty.html | loyalty.manage |
| affiliates | Affiliates | affiliates.html | affiliates.manage |
| campaigns | Notifications & campaigns | campaigns.html | campaigns.manage |
| customers | Customers | customers.html | customers.view |
| suppliers | Suppliers & POs | suppliers.html | suppliers.manage |
| delivery | Delivery & couriers | delivery.html | delivery.manage |
| reports | Reports | reports.html | reports.view |
| staff | Staff | staff.html | staff.manage |
| roles | Roles & permissions | roles.html | roles.manage |
| settings | Settings | settings.html | settings.manage |
| audit | Audit log | audit.html | audit.view |
Group headings: Overview / Sales / Catalog / Marketing / People & partners / System. Mobile: hamburger → drawer.

Extra perms used on buttons: `orders.edit`, `orders.cancel`, `orders.refund`, `refund.approve_high`, `customers.flag`, `customers.wallet_adjust`, `products.delete`, `settings.payments`.
Demo roles → perms: Owner = all; Manager = all except roles.manage, settings.payments, audit.view; Order staff = dashboard.view, orders.*, returns.view, tickets.view, customers.view, delivery.manage; Catalog editor = dashboard.view, products.*, categories.manage, inventory.view, reviews.manage; Support = dashboard.view, tickets.view, orders.view, returns.view, customers.view, reviews.manage; Marketing = dashboard.view, promos.manage, cms.manage, loyalty.manage, affiliates.manage, campaigns.manage, reports.view.

## Shared CSS components (A defines in admin.css; others use these class names)
`.a-card` (+ `.a-card-h` header row, `.a-card-b` body), `.a-grid-2/.a-grid-3/.a-grid-4` (responsive), `.a-stat` (label, big value, delta `.up/.down`), `.a-table-wrap > table.a-table` (sticky header, row hover, `.num` right-aligned, checkbox col), `.a-toolbar` (filters row: search input, selects, date range, chips), `.a-tabs > button.a-tab[aria-selected=true]` (with `.a-count` bubble), `.a-badge.ok/.warn/.danger/.info/.muted`, `.a-btn` (+ `.primary .accent .ghost .danger .sm .icon`), `.a-field` (label, input/select/textarea, `.a-hint`, `.a-err`), `.a-switch` (checkbox toggle), `.a-range` (slider + value), `.a-pill` (removable filter pill), `.a-empty` (empty state), `.a-pager`, `.a-timeline` (vertical, `.done/.current`), `.a-kv` (key/value list), `.a-avatar`, `.a-dropzone` (image upload mock), `.a-steps`, `.a-split` (list + detail two-pane). Look: brand D style — dense, 4px radius, crisp borders, bold numbers.

## Business rules to show (decided)
- Launch = COD only; online payments (bKash, Nagad, SSLCommerz-type gateway), advance payment and pre-orders are OFF at launch via settings feature flags `online_payments_enabled`, `advance_payments_enabled`, `preorders_enabled`.
- Advance payment (when enabled): COD orders with a delivery fee pay the fee in advance; + X% if product has `advance %` (also used for dropship items), customer flagged risky (admin %), or single item price > admin ৳X (admin %). Several triggers → %s added together, capped at 100% (Q111).
- Delivery: zones with base charge + per-kg extra, ETA, per-zone `free above ৳X` (blank = never, 0 = always). One delivery charge per order even with split shipments. Couriers: Pathao, Steadfast (API booking, staff picks per order). No own riders/pickup points.
- Orders go straight to Processing (no mandatory confirmation); staff may call, then hold/block. Fraud v1 = velocity flags (same phone/device/IP). Staff can edit orders before courier hand-off (qty, address, items) — audit-logged, customer notified. Statuses: Pending payment, Processing, On hold, Partially shipped, Shipped, Delivered, Completed (after return window), Cancelled. Split shipments (stock + dropship).
- Returns: 7-day default window (per category/product override); return shipping paid by us if our fault, customer if change of mind; refund to original method or store wallet; refunds above admin ৳X need approval by someone with `refund.approve_high`.
- Catalog: 4 category levels; product in many categories; category attributes inherited by sub-categories and used as filters; up to 2 variant option types (each combo own SKU/price/stock/images); YouTube video link; pre-order (expected date, advance %); WYSIWYG description with "view HTML" switch (scripts stripped); category delete dialog: move everything to one target category OR delete category + subs + products (products with orders are archived, not deleted).
- Reviews: verified buyers only, photos, published immediately, staff can hide and reply publicly. Product Q&A.
- Promotions: coupons (all types, per-coupon stacking, payment-method-specific, collectable into wallet, segments, referral), flash sales, ONE event at a time with block builder, event prices site-wide. Home: carousel + category tiles + weighted random feed with admin sliders (new, discount, rating, pinned boosts; out-of-stock penalty).
- Loyalty: flat earn rate (no tiers), point value, expiry, min redeem, max % of order, credited after delivery + return window. Referral coupons. Store wallet spend-only.
- Affiliates: % per order after return window, monthly payout via bKash/bank by staff, self-service dashboard; 30-day click attribution, code at checkout overrides.
- Suppliers: product↔supplier links, dropship forwarding (per supplier: ship direct to customer or to our warehouse first), purchase orders, supplier portal (login, see orders, confirm stock, mark ready); direct parcels booked on OUR courier account with pickup at supplier.
- Staff: multiple roles, permissions combine, nobody grants more than they have; 2FA (authenticator), session timeout, new-device login alerts. Audit log of sensitive actions. No masking of customer contact data.
- Customers: separate from staff; guest orders auto-link after phone OTP; risky flag; wallet adjust; points.
- Tickets: web/app form + staff-logged phone calls.
- Notifications: SMS, email, in-app inbox, web push. SMS/email provider swappable (settings).
- VAT-inclusive single store rate; invoice shows VAT portion + BIN.

## Agents and owned files
- **A — Shell + system**: `admin/shared/admin-boot.js`, `admin/shared/admin-core.js`, `admin/shared/admin.css`, `admin/shared/system.css`, `admin/shared/page-{login,dashboard,staff,roles,settings,audit}.js`, `admin/{login,index,staff,roles,settings,audit}.html`, `admin/README.md` (page list + how to add a page). Build admin-core.js + admin.css FIRST (other agents are waiting to test against it).
- **B — Sales ops**: `admin/shared/sales.css`, `admin/shared/page-{orders,order,returns,tickets}.js`, `admin/{orders,order,returns,tickets}.html`.
- **C — Catalog**: `admin/shared/catalog.css`, `admin/shared/page-{products,product-edit,categories,inventory,reviews}.js`, `admin/{products,product-edit,categories,inventory,reviews}.html`.
- **D — Marketing**: `admin/shared/marketing.css`, `admin/shared/page-{coupons,flash-sales,events,home-feed,loyalty,affiliates,campaigns}.js`, matching `admin/*.html`.
- **E — People, partners, logistics, reports + portals**: `admin/shared/partners.css`, `admin/shared/page-{customers,customer,suppliers,purchase-orders,delivery,reports}.js`, matching `admin/*.html`; plus `supplier/index.html` + `supplier/portal.js` + `supplier/portal.css` (supplier portal, own minimal shell, may reuse ../admin/shared/admin.css classes) and `affiliate/index.html` + `affiliate/portal.js` + `affiliate/portal.css` (affiliate self-service dashboard).

## Done when
`node --check` passes on your JS; each of your pages renders in the browser with no console errors (if admin-core.js is not ready yet when you finish your pages, wait/poll for it a few minutes, then test); works light + dark; no page-level horizontal scroll at 390px. Report ≤12 lines: files, what each page shows, gaps.

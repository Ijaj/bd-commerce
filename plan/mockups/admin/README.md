# Admin panel mockups

Static HTML/CSS/JS, opens via `file://` (no build). Start at `login.html` (any credentials; 2FA code any 6 digits) or `index.html`. Use **View as** in the top bar to switch demo role (Owner, Manager, Order staff, Catalog editor, Support, Marketing, plus "Team lead (demo)" for the grant-rule demo). Light/dark toggle in the top bar. Data is fake; settings, roles, staff and audit entries persist in `localStorage` (`admin.*` keys).

## Pages
| Page | File | Agent |
|---|---|---|
| Sign in (+2FA, `?expired=1`) | login.html | A |
| Dashboard | index.html | A |
| Staff | staff.html | A |
| Roles & permissions | roles.html | A |
| Settings (tabs, feature flags) | settings.html | A |
| Audit log | audit.html | A |
| Orders / Order detail | orders.html, order.html?id= | B |
| Returns & refunds | returns.html | B |
| Support tickets | tickets.html | B |
| Products / Product editor | products.html, product-edit.html | C |
| Categories & attributes | categories.html | C |
| Inventory | inventory.html | C |
| Reviews & Q&A | reviews.html | C |
| Coupons | coupons.html | D |
| Flash sales | flash-sales.html | D |
| Event pages | events.html | D |
| Home & feed | home-feed.html | D |
| Loyalty, referral & wallet | loyalty.html | D |
| Affiliates | affiliates.html | D |
| Notifications & campaigns | campaigns.html | D |
| Customers / Customer detail | customers.html, customer.html?id= | E |
| Suppliers & POs | suppliers.html, purchase-orders.html | E |
| Delivery & couriers | delivery.html | E |
| Reports | reports.html | E |
| Supplier portal / Affiliate portal | ../supplier/index.html, ../affiliate/index.html | E |

## Shared files (`shared/`)
`admin-boot.js` (theme before paint), `admin-core.js` (`window.Admin`: renderPage, modal, drawer, toast, fmt, store, can/data-perm, icons, chart.line/bars/donut, on/emit, audit.log, tabs, confirm, roles/permGroups), `admin.css` (shell + `.a-*` components), `system.css` (A's pages), plus per-group CSS and `page-*.js`.

## Add a page
1. Copy any `*.html` (e.g. `audit.html`): keep the skeleton, point the last `<script>` at `shared/page-<name>.js`, link your group CSS.
2. Add the nav entry in `admin-core.js` `NAV` (key, label, href, perm) if it is a new top-level page.
3. In `page-<name>.js` call `Admin.renderPage({ active:'<nav key>', title, crumbs:[[label,href],...], actions:html, body:html, onReady(root){...} })`. Use `data-perm="x.y"` on gated buttons, `Admin.toast`, `Admin.drawer.open`, and `Admin.audit.log(action, entity, before, after)` for sensitive actions.
4. Style with `.a-card .a-table-wrap > table.a-table .a-badge .a-btn .a-field` etc.; put page-specific CSS in your own file, never in `admin.css`.
5. Check: `node --check shared/page-<name>.js`, no console errors, light + dark, no horizontal page scroll at 390px.

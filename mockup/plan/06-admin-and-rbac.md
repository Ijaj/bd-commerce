# 06 — Admin Panel & RBAC

## Admin modules — **all v1** (Q63)

| Module | Contents |
|---|---|
| Dashboard | Today's orders, revenue, visitors, flagged orders, low stock, alerts |
| Analytics | Sales, AOV, conversion funnel, visitors (new vs returning, visit counts per visitor), traffic sources, top products/categories, search terms + zero-result searches, coupon/event/affiliate performance, courier success rates |
| Orders | List + filters, detail, status changes, optional call notes, hold/cancel, split shipments, courier booking (multi-courier), invoices/labels, bulk actions, history |
| Returns & refunds | Requests, approval (above ৳X needs approver), refund to method or wallet |
| Products | CRUD, 2-option variants, attributes, images, YouTube video, WYSIWYG/HTML description, pre-order, bulk import/export, duplicate |
| Categories | Tree editor (drag & drop, max 4 levels), images, show-on-home toggle, sort, attributes per category, delete dialog (move vs delete-all) |
| Brands | CRUD + logo |
| Inventory | Stock levels, adjustments, history, low-stock alerts |
| Suppliers & POs | Suppliers, product links, dropship forwarding, purchase orders, receiving, supplier portal accounts (Q88) |
| Customers | List, profile, orders, addresses, wallet, points, notes, block |
| Visitors | Anonymous visitor stats from tracking cookie |
| Promotions | Coupons (full feature set), flash sales, events + block page builder, referral settings, loyalty settings, affiliates (+ monthly payouts) |
| Content (CMS) | Carousel, home featured categories, static pages, menus, footer, announcement bar, maintenance mode |
| Reviews & Q&A | Hide/unhide reviews, staff replies, answer questions |
| Support tickets | From web/app form + staff-logged phone calls; assignment, status (S29, Q84) |
| Notifications | SMS/email/push templates (EN/BN), push campaigns |
| Settings | Store info, delivery zones & charges, payment methods, COD advance rules, velocity rules, courier credentials, VAT/BIN, tracking pixels, languages, SEO defaults, feed weight sliders (Q83), refund approval threshold (Q71), guest-COD OTP threshold (Q81) |
| Staff & roles | Staff accounts, roles, permission matrix |
| Audit log | Who did what, when, before/after values (S25) |

## RBAC [USER + DECIDED]

### Concepts
- **Permission** = `resource` × `action` (e.g. `products.edit`). Fixed list defined by the system.
- **Role** = named set of permissions, created/edited in the UI (dynamic).
- **Staff user** can have **multiple roles**; effective permissions = union (Q64).
- **Super admin** has everything, cannot be deleted or locked out.
- **Managing roles is a grantable permission** (`roles.manage`, `staff.assign_roles`). Rule: nobody can create/edit a role or assign a permission they don't hold themselves (Q65).
- No category-scoped roles in v1 (Q66). No masking of customer contact data (Q67).
- Approval workflow: refunds above ৳X (admin setting) need someone with `refunds.approve_high` (Q69, Q71).
- Staff security: 2FA (authenticator app), inactivity session timeout, new-device login alerts to super admin (Q68).

### Matrix UI (draft)

Rows = resources, columns = actions, checkbox per cell. One screen per role.

| Resource | View | Create | Edit | Delete | Export | Special |
|---|---|---|---|---|---|---|
| Dashboard / analytics | ☐ | | | | ☐ | view revenue numbers |
| Orders | ☐ | ☐ | ☐ | ☐ | ☐ | change status, hold/cancel, book courier, split shipment |
| Returns/refunds | ☐ | ☐ | ☐ | | ☐ | approve refund, approve high refund |
| Products | ☐ | ☐ | ☐ | ☐ | ☐ | publish, edit price, see cost price, import |
| Categories | ☐ | ☐ | ☐ | ☐ | | set home categories, delete-with-products |
| Inventory | ☐ | | ☐ | | ☐ | adjust stock |
| Suppliers & POs | ☐ | ☐ | ☐ | ☐ | ☐ | approve PO, receive stock |
| Customers | ☐ | ☐ | ☐ | ☐ | ☐ | block, adjust wallet/points |
| Promotions (coupons, flash, events, referral, loyalty, affiliates) | ☐ | ☐ | ☐ | ☐ | ☐ | publish event, pay affiliates |
| Content / CMS | ☐ | ☐ | ☐ | ☐ | | maintenance mode |
| Reviews & Q&A | ☐ | | ☐ | ☐ | | hide, reply |
| Support tickets | ☐ | ☐ | ☐ | | ☐ | assign |
| Notifications | ☐ | ☐ | ☐ | ☐ | | send campaign |
| Settings | ☐ | | ☐ | | | payment/courier credentials |
| Staff & roles | ☐ | ☐ | ☐ | ☐ | | manage roles, assign roles |
| Audit log | ☐ | | | | ☐ | |

Default role templates (editable): Super Admin, Manager, Catalog Editor, Order Processor / Call Center, Warehouse/Packer, Marketing, Customer Support, Accountant (view-only finance).

# 10 — Decisions Log

Answers to doc 08 questions (session 2026-10-22). Main docs updated to match and marked [DECIDED].

## A. Business & scope
| ID | Decision |
|---|---|
| Q1 | Name not decided; working name `bd-commerce`. Name ideas to come with the brand identity |
| Q2 | Single vendor now; data model ready for a marketplace later |
| Q3 | Mix: some stock held, some dropshipped |
| Q4 | B2C only, no wholesale pricing |
| Q5 | Android after web launch (PWA covers mobile until then, S12) |
| Q6 | Built by owner + Claude. No deadline, quality first |
| Q7 | Small year 1: <5k products, <100 orders/day, <5k visitors/day |
| Q8 | EN + BN toggle; price format `৳1,25,000` (lakh grouping, English digits) |
| Q39 | Hosting decided with tech stack |

## B. Storefront
| ID | Decision |
|---|---|
| Q9 | Dark mode: yes (toggle + follow system) |
| Q10 | Desktop header extras: top utility bar, wishlist icon, language toggle, dark mode toggle |
| Q11 | Android bottom nav: Home / Categories / Offers / Cart / Account |
| Q12 | Product card: image, **1-line** title, price, old price + discount %, rating + sold count, badges. No add-to-cart on card |
| Q13 | Home page fixed: carousel → categories → random feed (no admin section builder) |
| Q14 | Desktop: side category menu beside carousel + image tile grid below. Mobile: 2-row horizontal tile scroll |
| Q15 | Category label: bold text on solid colored chip below image |
| Q16 | Weighted random feed (boost new, discounted, high-rated, admin-pinned) |
| Q17 | Out-of-stock shown in feed with label, ranked low |
| Q18 | Special rows every N products in feed (flash sale, recently viewed, event banner) |
| Q38 | No brand identity yet; propose in mockups |

## C. Catalog
| ID | Decision |
|---|---|
| Q19 | 4 levels total (main + 3 sub levels) |
| Q20 | Images required for main categories, optional for sub-categories |
| Q21 | A product can be in multiple categories |
| Q22 | Products can be attached at any level |
| Q23 | Deleting a category: always ask in a dialog — (a) move its products (and sub-categories) to another category, or (b) delete the category, its sub-categories **and** all their products. Follow-ups Q70, Q73 |
| Q24 | Variants: up to 2 option types (e.g. Color × Size); each combo own SKU/price/stock/images |
| Q25 | Category attributes defined per category, inherited by sub-categories, used as filters |
| Q26 | Product video: YouTube links only |
| Q27 | Pre-order: yes (expected date, optional advance payment) |
| Q28 | HTML allowed: basic formatting, tables, images, YouTube iframes, inline styles. Scripts/event handlers/`javascript:` always stripped |
| Q29 | Editor: WYSIWYG with "view HTML" switch |
| Q30 | Search: English only at launch; Bangla search later |
| Q35 | Reviews: verified buyers only, photos allowed, staff can reply publicly, **no** pre-moderation (publish immediately, staff can hide) |
| Q36 | Product Q&A: yes |

## D. Customers, tracking, notifications
| ID | Decision |
|---|---|
| Q31 | Own visitor tracking + FB Pixel/CAPI + Google Analytics + TikTok Pixel (confirmed in round 2) |
| Q32 | Raw tracking data kept forever |
| Q33 | Login: phone + password, email + password, Google/Facebook. No OTP-only login |
| Q33b | OTP (SMS) for phone verification at signup and for password reset |
| Q34 | Guest checkout allowed |
| Q37 | Notifications v1: SMS, email, in-app inbox, web push (Android push with app) |
| Q40 | Privacy policy page + one-time dismissible cookie notice |

## E. Promotions
| ID | Decision |
|---|---|
| Q41 | "Description" meant **discount** system |
| Q42 | Payment-method-specific discounts: yes |
| Q43 | Stacking is a per-coupon setting |
| Q44 | Collect-coupon wallet: yes |
| Q45 | All coupon features in v1 |
| Q46 | Flash sales in v1 |
| Q47 | Event pages: block builder |
| Q48 | One event at a time |
| Q49 | Event prices apply everywhere on the site during the event |

## F. Orders, payments, delivery
| ID | Decision |
|---|---|
| Q50 | Delivery charge: zone base + weight extra + free above ৳X + per-product override |
| Q51 | Payments v1: COD, bKash direct, Nagad direct, one aggregator gateway (SSLCommerz or similar) |
| Q52 | COD partial advance by admin rules (e.g. order > ৳X or flagged customer pays delivery charge first) |
| Q53 | No mandatory confirmation. Orders go straight to processing; staff **may** call and then block or let the order continue |
| Q54 | Fraud v1: velocity rules only (flag many orders from same phone/device/IP). Courier history lookup + blacklist later |
| Q55 | Split shipments: yes (needed for stocked + dropshipped mix) |
| Q56 | Multiple couriers via API; staff picks courier per order |
| Q57/58 | No own riders, no pickup points |
| Q59 | Return window 7 days default, overridable per category/product |
| Q59b | Refund to original payment method or store wallet credit |
| Q60 | One own warehouse + suppliers for dropship items |
| Q61 | Reserve stock when order is placed; release on cancel |
| Q62 | Full supplier module: suppliers, product↔supplier link, dropship order forwarding, purchase orders |

## G. Admin & RBAC
| ID | Decision |
|---|---|
| Q63 | All admin modules in v1 |
| Q64 | Staff can have multiple roles; permissions combine |
| Q65 | "Manage roles" is a grantable permission; nobody can grant more than they have |
| Q66 | No category-scoped roles in v1 |
| Q67 | No masking of customer contact data |
| Q68 | Staff security: 2FA (authenticator app), session timeout, new-device login alerts |
| Q69 | Approval workflow only for refunds above ৳X |

## Suggested features (doc 07)
| Result | IDs |
|---|---|
| **v1** | S1, S2, S3, S4, S6, S10, S11, S12, S13, S14, S15, S16 (email only — SMS costs more), S17, S18, S19, S20, S22 (optional call, see Q53), S23, S24, S25, S26, S28, S29, S31, S32, S33, S34, S35, S36 (with Android app) |
| **Later** | S5, S7, S8, S9, S21 (only velocity rules in v1), S30 |
| **No** | S27 (one warehouse) |

## Round 2 (Q70–Q84)
| ID | Decision |
|---|---|
| Q70 | Deleting a product with orders → archive (hidden everywhere, kept for history/reports). Products with no orders are hard-deleted |
| Q71 | Refund approval threshold = admin setting; approver = anyone with "approve high refund" permission |
| Q72 | First couriers: Steadfast + Pathao |
| Q73 | Category delete → move: everything (products + sub-categories) goes under one chosen target category |
| Q74 | Payment aggregator: decide later by fees |
| Q75 | SMS provider: decide later; provider must be swappable |
| Q76 | Loyalty points fully admin-configurable (earn rate, point value, expiry, min redeem, max % of order); points credited after delivery + return window |
| Q77 | Referral: new customer gets coupon on signup; referrer gets coupon after friend's first delivered order; amounts in admin |
| Q78 | Affiliates: % per order (counted after return window), paid monthly via bKash/bank by staff; affiliates get a self-service dashboard (clicks, orders, earnings) |
| Q79 | Store wallet: spend only, no cash-out |
| Q80 | Pre-orders: always partial advance (admin-set %), rest on delivery |
| Q81 | Guest COD orders above admin-set ৳X require SMS OTP |
| Q82 | Dropship flow per supplier: ships direct to customer, or to our warehouse first |
| Q83 | Home feed weights: admin sliders (new, discount, rating, pinned boosts; out-of-stock penalty) |
| Q84 | Support tickets: web/app form + staff-logged phone calls (no email-in) |
| — | Staff can edit orders before courier hand-off (qty, address, items); permission-gated, audit-logged, customer notified |

## Round 3 (Q85–Q90, raised by flowcharts)
| ID | Decision |
|---|---|
| Q85 | One delivery charge per order, even when split into several shipments |
| Q86 | Online payment timeout 30 min (admin setting); then auto-cancel + release stock |
| Q87 | Return shipping: we pay if our fault (wrong/damaged/defective), customer pays for change of mind |
| Q88 | Dropship suppliers use a **supplier portal** (login, see orders, confirm stock, mark ready). Direct-to-customer parcels booked on **our** courier account with pickup at supplier |
| Q89 | Affiliate attribution: link click valid 30 days; affiliate code at checkout overrides |
| Q90 | Cancel / payment timeout / failed delivery restores coupon use, points and wallet |

Note on S6: our order tracking covers status until the parcel is handed to the courier (Pathao, Steadfast, etc.). After that we show the courier name + tracking ID/link; the courier handles tracking from there.

## Round 4 (Q91–Q95, raised by data model, doc 12)
| ID | Decision |
|---|---|
| Q91 | Separate account tables: customers, staff, supplier_users. Staff shop with a normal customer account |
| Q92 | Split shipments on COD: whole delivery charge collected on the first shipment sent |
| Q93 | No loyalty tiers in v1 (flat earn rate); coupon "loyalty tier" segment dropped |
| Q94 | Guest orders auto-link to an account once the same phone is OTP-verified |
| Q95 | Prices VAT-inclusive at one store rate (setting); invoice shows VAT portion + BIN; per-product override kept for later |

## Round 5 (Q96–Q99, gate 5 mockups)
| ID | Decision |
|---|---|
| Q96 | Mockups = static HTML/CSS in `plan/mockups/` (file://), working dark mode + EN/BN toggle, desktop + mobile widths |
| Q97 | Brand look: 3 palette/vibe options on the home page first; owner picks one, rest of screens use it |
| Q98 | Shop name: placeholder `ShopName` in mockups; decide name later |
| Q99 | Mockups built by Sonnet sub-agent in batches: 1) brand options, 2) storefront screens, 3) admin screens; review between batches |
| Q100 | Brand still open: move A/B/C tokens to `shared/brand-*.css`; every mockup page gets an A/B/C switcher (remembered) |
| Q101 | Batch 2 pages: category + search, product detail, order process (cart → checkout → payment → success → tracking), account area + event page |
| Q102 | Audit fixes from batch-1 review done in batch 2 (shared CSS/JS first) |

## Round 5b (Q103–Q106, from mockup review)
| ID | Decision |
|---|---|
| Q103 | Brand: **style of B** (dense deal-marketplace layout, angular tags, gradient header) **with colour palette of C** (indigo + teal). Name still `ShopName` |
| Q104 | Digits follow language: BN = Bangla digits everywhere **incl. prices** (`৳১,২৫,০০০`), EN = English digits (`৳1,25,000`). **Overrides Q8 digit rule.** Order IDs / phone / tracking IDs stay English digits |
| Q105 | Free delivery = customer pays no delivery fee at all. Per-zone free threshold (each zone own "free above ৳X"; 0 = always free, blank = never). Other zones pay standard fee |
| Q106 | Advance payment (replaces Q52 COD-advance logic). Triggers: (1) product flagged "requires advance" with X% (also used for dropship items, no special dropship rule); (2) risky customer (many returns / damage history); (3) high-priced product above admin ৳X. Amount: non-free delivery → delivery fee in advance; + flagged product → delivery fee + X% together; free delivery + flagged product → X% only; free delivery alone → nothing. Free delivery has nothing to do with whether advance is needed beyond the fee part |
| Q106b | **Launch = COD only. No advance payments at launch.** bKash/Nagad/SSLCommerz + advance payments enabled later (changes Q51 v1 scope). General rule: plan the full platform, but launch with a subset — features get a launch phase in the roadmap (gate 7) |
| Q107 | Risky-customer and high-price triggers charge: delivery fee (if not free) + admin-set % (same formula as flagged products) |
| Q108 | High-price trigger compares **single product unit price** > admin ৳X |
| Q109 | Pre-orders hidden at COD-only launch; enabled together with online payments |
| Q110 | Mockups get a demo "Launch / Full" phase toggle: Launch hides online payments, advance payment, pre-order |
| Q111 | Several advance triggers on one item → their %s are **added together** (product % + risky-customer % + high-price %), capped at 100% of the item. Delivery fee part unchanged. Mockups + doc 12 updated |
| Q112 | Admin panel is **English only** (no EN/BN toggle). Customer-facing output (SMS, invoices, storefront) still follows the shop language |
| Q113 | Typography: **no bold text** except page titles (h1), current breadcrumb and logo. Product names (incl. product-page title), prices, filter titles, buttons, section headings, body copy all regular weight (bold hurts Bangla readability). Font choice to be updated later by owner. Storefront mockups updated; admin unchanged |
| Q114 | Availability filter (In Stock / Pre-Order / Up-coming, like Star Tech) on every category, sub-category and search results page. New product flag `is_upcoming`: product is visible but has no add-to-cart/buy; customers can only wishlist it. Admin sees the wishlist count per upcoming product (demand signal) |
| Q115 | Availability filter always lists all 3 options, even at the COD-only launch (Pre-Order then shows 0 results) |
| Q116 | Admin attribute option editor: one row per option with its own EN + BN inputs, drag to reorder, delete. Replaces the comma-separated text field. Blank/duplicate options blocked on save |
| Q117 | "+ Add option" button sits in the options list header (top right); new rows append at the bottom so the button never moves. Enter in the last row adds a new row |
| S-T1 | Tech stack: **TypeScript full-stack** (web shop, admin, API) |
| S-T3 | Android app: **native Kotlin (Jetpack Compose)**, built after web launch (Q5) |
| S-T2 | Web storefront: **Next.js (React)**. Lightweight requirement still applies: keep client JS small (server components, minimal client libs) |
| S-T4 | Database: **PostgreSQL** (jsonb for {en,bn} + flexible attributes; built-in full-text search at launch) |
| S-T5 | Backend: **separate API service on NestJS**, REST, used by shop, admin and Android app |
| S-T6 | DB toolkit: **Prisma** (schema + migrations from day 1) |
| S-T7 | Admin panel: **separate app** (own subdomain/deploy), not inside the shop |
| S-T8 | Styling: storefront **plain CSS** (no CSS framework); admin **Tailwind + Mantine**, use Mantine stock styling as much as possible |
| S-T9 | Admin app: **Vite + React SPA** + Mantine, data from NestJS API |
| S-T10 | Repo: **monorepo, pnpm + Turborepo** (apps/shop, apps/admin, apps/api, shared packages) |
| S-T11 | Hosting: **self-hosted on 2-3 owner PCs with public static IP** (details S-T13+) |
| S-T12 | Images: **self-hosted MinIO + imgproxy** |
| S-T13 | Edge: **Cloudflare Tunnel** in front (no open ports, IP hidden, DDoS + SSL + caching; free tier 100 MB upload limit) |
| S-T14 | Run services with **Podman Compose per PC** (owner uses Podman, not Docker) |
| S-T15 | Database: **Postgres primary + live streaming replica** on a second PC (manual promote) |
| S-T16 | Backups: **local only for now** (other PCs on same site). Does not cover fire/theft/flood at the site |
| S-T17 | Uptime: **online UPS/IPS** for PCs + router, and **2 ISPs** with failover |
| S-T18 | Background jobs: **BullMQ + Redis** (Redis also for cache + rate limiting) |
| S-T19 | Sessions: **DB-backed sessions**; httpOnly secure cookie for web/admin, opaque token for Android app; instant logout / revoke |
| S-T20 | Monitoring: **self-hosted light set**: Uptime Kuma, GlitchTip, Beszel/Netdata |
| S-T21 | CI/CD: **GitHub Actions** for tests; **self-hosted runner** on an owner PC builds images and restarts services with Podman on merge to main |
| S-T22 | Email: **Amazon SES** |
| S-T23 | API contract: **OpenAPI spec generated by NestJS**; generated TS clients (shop, admin) and Kotlin client (Android) |
| S-T24 | Android code lives **in the monorepo** at apps/android |
| S-T25 | Runtime: **Node.js LTS** |
| S-T26 | Redis: **AOF persistence (fsync 1s) + replica** on second PC |
| S-T27 | Testing: **Vitest** (unit + API vs test Postgres in Podman) + **Playwright** end-to-end for key flows |
| S-T28 | Secrets: **SOPS + age** encrypted file in repo, passed as **Podman secrets** at deploy |

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
| S-T8 | Styling: storefront **plain CSS** (no CSS framework); admin **Tailwind + Mantine**, use Mantine stock styling as much as possible. **SUPERSEDED by C60 (stock styling no longer wanted)** |
| S-T9 | Admin app: **Vite + React SPA** + Mantine, data from NestJS API |
| S-T10 | Repo: **monorepo, pnpm + Turborepo** (apps/shop, apps/admin, apps/api, shared packages) |
| S-T11 | Hosting: **self-hosted on 2-3 owner PCs with public static IP** (details S-T13+) |
| S-T12 | Images: **self-hosted MinIO + imgproxy** (superseded by C6: Garage) |
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

## Roadmap (gate 7)
| ID | Decision |
|---|---|
| R1 | **4 phases**: P1 COD-only launch (core shop + operations), P2 payments (online pay, advance, pre-orders), P3 growth/retention, P4 Android app |
| R2 | Launch when P1 is feature-complete and tested; no fixed date |
| R3 | Builders: owner + Claude only; build in thin, testable slices |
| R4 | Go-live: soft launch (friends/family, limited ads, real COD orders) for a few weeks, then public |
| R5 | P1 core confirmed (catalog, home, cart + COD checkout, orders, inventory, accounts with phone/email + password + OTP, staff/RBAC/2FA, settings, EN/BN, SEO, images, order SMS/email, maintenance/announcement, monitoring/backups). **Google/Facebook login moved to P3** |
| R6 | P1 storefront extras: wishlist + up-coming, recently viewed + similar, reviews & Q&A, PWA. **New owner requirement: multi-store + SR dashboard in P1** (details being clarified, R9+) |
| R7 | P1 promotions: product discounts, coupons, flash sales. **Events + page builder → P3** |
| R8 | P1 operations: courier API (Steadfast + Pathao), call-confirmation queue, returns & refunds, bulk import/export |
| R9 | Multi-store idea **cancelled** (no stores/branches). Single vendor + one warehouse stands (Q2, S27) |
| R10 | **SR (sales representative) module in P1**: SRs are our field sales staff selling our stock to independent, unaffiliated shops, mostly bulk B2B. All SR sales are manual entries |
| R11 | SR sale deducts from our central stock; buyer shop is not linked to the online shop |
| R13 | SR fills a sale form first; staff with an "approve SR sales" permission approve/reject. Stock reserved on submit, deducted on approve |
| R14 | Buyer shops saved as a **B2B customer list** (shop name, owner, phone, address, area) with sales history |
| R15 | B2B price: **SR enters freely** per item; approver checks it |
| R16 | Payment: SR records amount collected; unpaid balance goes to the shop's **due (baki) ledger**; later collections recorded against it; admin sees dues per shop and per SR |
| R17 | SRs use a **mobile-first SR portal** (installable PWA), separate from admin; SR sees only own data |
| R18 | SR portal P1: sale forms, **due collection entries** (staff confirm), **own performance summary**, **targets + commission** (admin-set per SR), **add new buyer shops** from the field |
| R19 | B2B delivery: SR or own staff delivers from warehouse; marked delivered manually (no courier) |
| R20 | Each approved SR sale gets a numbered **printable memo/invoice** (PDF/image, EN/BN, shareable on WhatsApp) |
| R21 | P1 back-office: **invoice + labels (VAT/BIN)**, **suppliers + POs + dropship supplier portal**. Audit log and support tickets → P3 |
| R22 | P1 marketing: **analytics + visitor tracking**, **abandoned cart email**. FB Pixel/CAPI/GA and product feeds → P3 |
| R23 | P1 retention: **loyalty points**, **referral**, **affiliates + dashboard**. Store wallet → P3 (P1 refunds paid back manually, e.g. bKash/cash) |
| Q118 | SR portal, supplier portal and affiliate dashboard live in **one mobile-first partner portal app** (`apps/portal`, Vite + React) with role-based sections |
| Q119 | SR-added buyer shops are **usable immediately**, flagged "new" for staff review |
| Q120 | SR commission = % of **money collected** in the month (payment at sale + due collections) |
| R24 | P1 build order: **online shop first, SR module later in P1** (see doc 14) |
| R25 | SR portal + admin B2B pages get **static mockups first** (Sonnet agent), owner reviews before gate 8 |

## Coding phase (gate 8)
| ID | Decision |
|---|---|
| C1 | SR portal + admin SR/B2B mockups **approved** by owner, no changes (2026-10-23) |
| C2 | P1 step 1 built in **4 sub-steps**: 1a monorepo + Podman dev stack + CI; 1b Prisma + NestJS skeleton + OpenAPI client; 1c staff auth, 2FA, sessions, RBAC; 1d settings, flags, EN/BN helpers, maintenance. Commit + check-in after each |
| C3 | Step 1 schema = **foundation tables only**; later steps add their own tables via migrations |
| C4 | Git: **commit straight to main** until deploy-on-merge runner is live, then branches + PRs |
| C5 | Runtime: **Node 24 LTS** |
| C6 | Image storage: **Garage** replaces MinIO (S-T12 superseded; MinIO community edition stopped shipping images, maintenance-only). RustFS considered (1.0 GA Sept 2026, too new). Code uses plain S3 API so a later swap = copy objects + config |
| C7 | Lint/format: **Biome** (one tool, one config for the monorepo) |
| C8 | **TypeScript 7.0** (native compiler). Fall back to 6.0 per app if a tool breaks |
| C9 | API request validation: **Zod** (nestjs-zod); schemas shareable with frontends via packages/ |
| C10 | API client: **openapi-typescript + openapi-fetch** (types only, tiny runtime) |
| C11 | NestJS build: **SWC** builder; type-check separately with TS 7 `tsc --noEmit` |
| C12 | API framework: **NestJS 11** (Nest 12 is ESM and nestjs-zod does not support it yet; upgrade later). ORM: **Prisma 7.10** stable (8.0 still rc) |
| C13 | Staff 2FA (TOTP authenticator app) **required for all staff**; set up on first login before any admin access |
| C14 | 2FA recovery: **10 one-time backup codes** at setup + staff with manage-staff permission can **reset** another's 2FA (audit-logged); server CLI reset as last resort |
| C15 | Staff password hashing: **Argon2id** (@node-rs/argon2) |
| C16 | Default staff **idle timeout 8 hours** (admin setting, per-staff override) |
| C17 | Staff session **hard cap 7 days** (re-login with password + 2FA weekly), on top of 8h idle |
| C18 | 2FA reset traceability = **reset by / at on the staff row**; full audit_log stays out of P1 |
| C19 | Settings + feature flags: **own DB tables**, defaults in code, cached in Redis (no Unleash/GrowthBook) |
| C20 | Self-hosted deploy runner **moved from step 1 to step 9** (with production setup on owner PCs); GitHub CI tests every push meanwhile |
| C21 | Admin app routing + data: **TanStack Router + TanStack Query** (typed routes/search params, cached API data) |
| C22 | Product HTML editor: **Mantine TipTap** with a "view HTML" switch (Q29) |
| C23 | Image upload **through the API** (max 10 MB, sharp validates + strips EXIF, stored in Garage); imgproxy resizes on view, so no stored renditions |
| C24 | Bulk import/export: **XLSX + CSV** (exceljs), one row per variant |
| C25 | Step 2 built by a **parallel agent swarm** (owner request): lead (Opus) owns schema/migrations/shared files and commits; Sonnet agents per module; Haiku for the demo seed |
| C26 | Storefront URLs: **English at root, Bangla under `/bn/…`**, both indexed with hreflang |
| C27 | Google/Facebook login **later in P1** (before launch); step 3 = phone/email + password + SMS OTP only |
| C28 | PWA: **hand-written** manifest + small service worker (offline page, static/image cache), no library |
| C29 | Wishlist **requires login** (server-side); recently viewed kept **in the browser** (localStorage), no server table |
| C30 | Step 3 built by a parallel agent swarm like C25: lead (Opus) does schema/scaffold/contracts/commits; wave 1 = 4 Sonnet + 1 Haiku, wave 2 = account/PWA (Sonnet) + e2e (Haiku) |
| C31 | Swarm widened (owner): step 3 waves continue; **step 4 backend (cart/checkout/zones) and step 7 partner portal (SR module) start in parallel**. Lead adds their schema first; ~7 agents peak |
| C32 | Order number = **YYMM-NNNNN** (e.g. `2610-00123`): month prefix + one running number that never resets (DB sequence) |
| C33 | BD geo master (divisions/districts/upazilas, EN+BN) **seeded from an open dataset** via migration; admin edits later; courier codes mapped in step 5 |
| C34 | Partner portal (`apps/portal`) uses **Mantine** like admin |
| C35 | Guest cart = **server cart keyed by visitor cookie**, merged into the account cart on login |
| C36 | SR stock: **reserve on submit, deduct on deliver** (approve creates the shop's due only); supersedes R13 "deduct on approve" |
| C37 | SRs see **all active buyer shops** (shared, avoids duplicates) and the shop's total due; ledger lists only their own entries |
| C38 | SR memo shared via a **public signed link** (unguessable token, no login, revocable/expiring) |
| C39 | Partner portal UI **EN + BN toggle** |
| C40 | Delivery charge with product overrides (Q85): order pays **max(zone charge incl. per-kg extra, highest product override)**, once per order |
| C41 | Price changed since add-to-cart: order is **charged the current price without an extra confirm** (cart shows a "price changed" badge) |
| C42 | SR delivery (R19): **per-sale choice** "I deliver" / "staff delivers"; SR can mark own "I deliver" sales delivered, staff marks the rest |
| C43 | SR corrections: staff can **reject a pending collection** (with reason, never counted) and **reverse an approved/delivered sale** (reversing ledger entry + stock back); ledger stays append-only |
| C44 | Guest COD abuse (security review M4): **rate limits + caps** — max 5 orders/hour per IP, max 3 open guest orders per phone, daily guest total cap per phone (setting, default ৳20,000); confirmation SMS still sent |
| C45 | Q94 refined: auto-link **only OTP-verified guest orders** to the account that verifies the phone |
| C46 | SR unit price: **any price ≥ ৳1** (approver review is the control) |
| C47 | SR paid-at-sale cash: **approval = confirmation** (approver checks cash at approve time) |
| C48 | Reversing an SR sale whose commission is already approved/paid → **negative commission adjustment, auto-deducted in the SR's next commission run** (listed for staff) |
| C49 | OTP wrong-code lockout **escalating, per purpose**: 1 h after 10 wrong codes, 24 h after 30 |
| C50 | Public SR memo link limit **60 requests/min per IP** |
| C51 | Step 5 couriers: **adapter interface + in-memory fake courier now**; Steadfast/Pathao real adapters plug in via env keys when owner has accounts |
| C52 | Step 5 docs: **A4 invoice** (VAT portion + BIN per Q95, EN/BN) and **4x6in label PDF** (order no, address, COD amount, barcode) |
| C53 | Step 5 call queue: **auto-flag risky only** (velocity rules Q54, COD above setting threshold, first-time guest); staff confirm/cancel/note; non-blocking per Q53; others go straight to processing |
| C54 | Step 5 returns: **request → approve → receive → refund/reject**; per-item qty + reason, within 7-day window (Q59), restock or write-off on receive, refund to wallet credit or original method (manual mark-paid until online payments), return shipping per Q87 |
| C55 | Scheduled jobs (`sync-couriers`, `complete-orders`): **in-app scheduler** in the API (Nest schedule + Redis lock so one instance runs; env flag to disable) |
| C56 | Step 6 flash sales: **qty is capped** at what is left at flash price and at the per-customer limit (cart refuses more, "only N left at flash price"); no split lines |
| C57 | Step 6 combining: **all eligible auto discounts that stack with each other + at most 1 code**; a 2nd code only if both coupons allow stacking with other coupons (Q43 toggles stay) |
| C58 | Step 6 product discounts: **bulk sale tool** in admin (category/brand/products, % or fixed off, window → writes variant sale prices, one-click undo). Events + page builder stay P3 (R7); payment-method discount condition stored but only `cod` is live until online payments |
| C59 | Local staff sign-in: `.env` sets `DISABLE_2FA=true` for easier development; production refuses that setting, and API/e2e tests explicitly keep 2FA enabled |
| C60 | **UI must match the approved mockups (owner, 2026-10-25).** The mockups in `plan/mockups/` are the visual source of truth for admin, portal and shop; what was built in steps 1-6 (stock Mantine + a few colors) is NOT approved. Supersedes S-T8. Customize Mantine (theme + component overrides + a shared shell) to reproduce: brand-D tokens (light + dark), gradient top bar with wordmark + global search, dark sidebar with icons, visible group headings, active-item highlight bar, light/dark switch, page header (left-bar title, crumbs, actions), stat tiles, dense tables, badges, tabs, cards. Menus follow the mockup groups/labels/icons (Overview / Sales / Catalog / Marketing / People & partners / System); built pages that the mockup lacks (call queue, shipments, bulk sales, carousel...) are slotted into the nearest group. Work = new roadmap step 6b (before step 7 continues). Acceptance: side-by-side screenshots per page vs mockup, owner review |
| C61 | **Restyle only what exists; document the rest (owner, 2026-10-25, session 12).** Step 6b restyles existing screens only. Mockup parts whose feature/screen/API is not built are NOT built during the restyle; they are listed in `plan/15-ui-mockup-gaps.md` (admin, portal) and `plan/swarm/ui-fidelity/shop-gaps.md` §4 (shop), and each later step designs its UI from those mockups with `@bdc/ui`. Also: the owner runs and verifies the apps manually (no screenshots/e2e by agents this session) |
| C62 | Step 7 build order (owner, 2026-10-30, session 13): **7a** suppliers + POs + receiving (admin) → **7b** dropship forwarding + supplier portal → **7c** affiliates. One sub-step per session |
| C63 | Dropship variants: new variant field "fulfilled by: own stock / dropship" (default supplier from `variant_suppliers.is_default`). Dropship stock is a quantity the **supplier updates in the portal**; it reserves on order like own stock |
| C64 | PO receiving updates variant `cost_p` by **weighted average**: (on-hand × old cost + received × PO unit cost) ÷ (on-hand + received). Null old cost or zero on-hand → PO unit cost |
| C65 | **Supplier payables ledger in P1**: per-supplier balance; received PO lines and delivered dropship orders add to amount owed; staff record payments (cash/bKash/bank). Modelled like the B2B dues ledger |
| C66 | Supplier portal users sign in with **email + password + TOTP 2FA** (same rules as staff; DISABLE_2FA dev switch applies) |
| C67 | Affiliate dashboard lives in the **shop** (`/account/affiliate`) on the customer login, not the partner portal. **Supersedes Q118 for affiliates** (portal keeps SR + supplier sections) |
| C68 | Affiliate commission base = **item line totals after discounts (coupon/flash), excluding delivery**; returned lines reverse their share |
| C69 | Affiliate guards: **block self-referral** (buyer = affiliate customer, or same phone/address); **minimum payout** setting (balance below it carries over to next month); commission counts only after delivery + return window (Q78) |
| C70 | **No staff approval to join** the affiliate program (owner left it unselected): a customer who joins is active at once; staff can suspend. Default commission rate is a setting; per-affiliate override allowed |
| C71 | Step 7a receiving (owner, 2026-10-30, session 14): receive at most the remaining qty per line (no over-receive). Staff can **Close PO** on a partly received PO: the rest is dropped and nothing is owed for it. Over-delivery needs a PO edit or new PO |
| C72 | Receiving records **good qty + rejected qty** per line. Only good qty goes to stock, cost (C64) and the payable; rejected qty counts toward the line (not awaited again) and shows on the PO with the receiving note |
| C73 | Step 7a perms: `suppliers.view` (read), `suppliers.manage` (suppliers, product links, POs), `purchase_orders.receive` (warehouse staff), `supplier_payments.manage` (payments + adjustments) |
| C74 | PO lines: **any variant**; the picker lists variants linked to that supplier first (with last cost). Adding a variant to a PO creates the variant↔supplier link if missing; links also editable on the supplier screen |
| C75 | **Send to supplier**: PO becomes `sent` (lines locked; only expected date + notes editable), supplier gets the PO by email if it has one (Mailpit in dev), admin has an A4 PO print view (invoice print pattern) |
| C76 | Supplier ledger entries: receipt (+owed), payment (−owed), **manual adjustment** (signed, reason required: credit note, discount, opening balance). Append-only; mistakes fixed by a reversing entry |
| C77 | Supplier payments need **no second-person approval**: staff with `supplier_payments.manage` record method (cash/bKash/Nagad/bank) + reference and it counts at once |

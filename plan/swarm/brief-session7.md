# Step 3 swarm brief: Storefront browse (bd-commerce)

Repo: /home/ijaj/webdev/bd-commerce (pnpm 11 + Turbo monorepo, Node 24, TypeScript 7, Biome). Read the repo `CLAUDE.md` "Resume state" and `README.md` once. Decisions are in `plan/10-decisions-log.md` (grep it; don't read whole plan). Storefront spec: `plan/02-storefront.md`. Data model: `plan/12-data-model.md`. Mockups (approved look): `plan/mockups/*.html` + `plan/mockups/shared/*.css|js` (brand = style B layout with palette C, Q103). Old reference project: `~/webdev/baby-commerce` (lessons in `plan/09-baby-commerce-reuse.md`).

Board (append-only, everyone reads/writes): `/tmp/claude-1000/-home-ijaj-webdev-bd-commerce/68689192-4799-4550-a8cf-20a0d61664dc/scratchpad/swarm/BOARD.md`. Append with `cat >> BOARD.md` (never rewrite). Format: `[agent-id HH:MM] message`. Post: when you start, any contract change you need, when a shared thing is ready, blockers, and DONE with a summary.

## Hard rules

- **Do not commit, push, or run `git add/stash/checkout/reset`.** Lead (Opus) reviews and commits. Other agents edit the tree at the same time; never revert files you don't own.
- **Stay inside your owned paths** (see your task). Shared files are lead-only: `apps/api/prisma/**`, `apps/api/src/app.module.ts`, `apps/api/src/auth/permissions.ts`, `apps/api/src/settings/registry.ts`, root `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `biome.json`, `packages/api-client/**`. Need a change there → post on the board and keep working (stub locally if needed).
- Don't run `pnpm api:gen` yourself unless your task says so; lead runs it. Don't run `prisma migrate`.
- Don't start/stop the Podman stack (it's up: Postgres :5432, Redis, Garage, imgproxy, Mailpit :8025). Don't kill other agents' processes. If you run a dev server, use the port in your task.
- pnpm 11: new deps must be older than the min release age; if install fails on age, pick an older version. Pin exact versions (repo style). Ask on board before adding a heavy dep.
- Match existing code style: read 1–2 neighbouring files first. Comments sparse, explain *why*. Biome must pass (`pnpm biome check <your paths>`; `--write` to fix).
- Before DONE: your package's `typecheck` + `test` pass, biome clean on your paths. Report exact commands and results honestly.
- Money is integer paisa (`*_p`, `priceP`). Bilingual text = `xEn` + optional `xBn` (fall back to EN). Use `@bdc/i18n` (`formatPrice`, `digits`, `pickText`) in UI.
- Typography rule Q113: no bold except h1, current breadcrumb, logo.

## Already done by lead (wave 0, commit 6eb812e)

- Prisma models (generated client in `apps/api/src/generated/prisma`): `Customer` (phone `01XXXXXXXXX` unique nullable, email lower-case unique nullable, passwordHash, lang en|bn, phoneVerifiedAt, emailVerifiedAt, disabledAt, lastLoginAt, isFlagged), `CustomerSession` (tokenHash, ip, userAgent, lastSeenAt, expiresAt, revokedAt), `OtpCode` (purpose signup|reset|guest_cod|phone_change, phone, codeHash, attempts, expiresAt, usedAt, ip), `Wishlist` (customerId, productId, unique pair), `CarouselSlide` (title, imageDesktopMediaId, imageMobileMediaId?, linkUrl?, startsAt?, endsAt?, sort, isActive, lang all|en|bn). Featured home categories = existing `Category.showOnHome` (+ `categories.set_home` perm).
- Search indexes: GIN on `to_tsvector('english', title_en || ' ' || coalesce(short_description_en, ''))` (use that exact expression in raw SQL to hit it) + pg_trgm GIN on `products.title_en` and `brands.name_en`.
- `SmsService.send({to, text})` (global module `src/sms`): dev → Mailpit as `sms+<phone>@sms.local`; tests → `smsService.outbox`.
- Permissions: `content.manage`, `customers.view`, `customers.manage`.
- Settings: `shop_contact` {hotline,email} (public), `home_feed` {newBoost,newDays,discountBoost,ratingBoost,pinnedBoost,outOfStockPenalty,specialRowEvery} (private), `customer_session_days` (60).
- Empty Nest modules wired in app.module: `CustomersModule` (`src/customers/customers.module.ts`), `StorefrontModule` (`src/storefront/storefront.module.ts`). Fill them; you may add submodules imported by them.

## Decisions for this step

- C26: shop URLs **English at root, Bangla under `/bn/...`**; hreflang alternates on every page. Admin is English only.
- C27: no Google/Facebook login yet. Phone/email + password + SMS OTP only.
- C28: PWA = hand-written manifest + small service worker (no library).
- C29: wishlist requires login (server); recently viewed = browser localStorage only.
- S-T2/S-T8: shop = Next.js (App Router, server components first, minimal client JS), **plain CSS** (CSS modules or global CSS with custom-property tokens; no Tailwind/CSS framework). Lightweight on low-end phones.
- S-T19: customer session = DB-backed, httpOnly secure cookie (web).
- Q30: search English only. Q114: availability filter (In Stock / Pre-Order / Up-coming) on every category + search page. Q16/Q17: weighted random home feed, out-of-stock shown with label, ranked low; fixed order per page load (seed), infinite scroll. Q18: special row every N products.

## Public API contract (prefix `/v1/public`, no auth, all GET unless noted)

Shapes below are the contract; agent B implements, shop agents consume. Field names exact. Only `status=active` products with `publishedAt <= now` and active categories/brands are public.

```ts
type ImageSet = { alt: string | null; width: number; height: number;
  url320: string; url640: string; url1200: string }   // signed imgproxy WebP, fit
type Badges = { isNew: boolean; isPreorder: boolean; isUpcoming: boolean; outOfStock: boolean }
type ProductCard = { id: string; slug: string; titleEn: string; titleBn: string | null;
  image: ImageSet | null; priceP: number;            // effective price (sale price if active sale window)
  compareAtP: number | null;                          // struck-through; max(compareAtP, priceP when on sale)
  discountPct: number | null; ratingAvg: number; ratingCount: number; soldCount: number; badges: Badges }
type CategoryNode = { id: string; slug: string; nameEn: string; nameBn: string | null; level: number;
  chipColor: string | null; image: ImageSet | null; icon: ImageSet | null; children: CategoryNode[] }
type Crumb = { slug: string; nameEn: string; nameBn: string | null }
```

- `GET /public/categories/tree` → `CategoryNode[]` (active only, sorted).
- `GET /public/home` → `{ slides: {id,title,linkUrl,desktop: ImageSet, mobile: ImageSet|null}[], featuredCategories: CategoryNode[] /* showOnHome, no children */ }`. Slides filtered by isActive + time window; `?lang=en|bn` filters slide.lang.
- `GET /public/feed?seed=<int>&cursor=<string?>&limit=24` → `{ items: ProductCard[], nextCursor: string | null }`. Same seed = same order (stable across pages, no duplicates). Weights from `home_feed` setting.
- `GET /public/products` query: `category` (slug; includes descendants), `q` (search), `brand` (comma slugs), `minPrice`,`maxPrice` (paisa), `rating` (min int), `availability` (comma of `in_stock,preorder,upcoming`), `attr.<key>` (comma option ids, for select/multiselect; boolean `true`), `sort` (`relevance|newest|price_asc|price_desc|popular|rating`, default `relevance` with q else `popular`), `page` (1-based), `limit` (default 24, max 60) →
  `{ items: ProductCard[], total: number, page: number, limit: number,
     facets: { brands: {slug,nameEn,nameBn,count}[], price: {min:number,max:number}|null,
               availability: {in_stock:number, preorder:number, upcoming:number},
               attributes: {key,nameEn,nameBn,type,unit,options:{id,valueEn,valueBn,count}[]}[] },
     category: null | { id,slug,nameEn,nameBn,descriptionEn,descriptionBn,seoTitle,seoDescription,
                        banner: ImageSet|null, breadcrumb: Crumb[], children: CategoryNode[] } }`
  Attributes facet = filterable attributes of the category and its ancestors.
- `GET /public/search/suggest?q=` (min 2 chars) → `{ products: {slug,titleEn,titleBn,image:ImageSet|null,priceP}[] (max 6), categories: Crumb[] (max 4), brands: {slug,nameEn,nameBn}[] (max 4) }`.
- `GET /public/products/:slug` → 404 if not public. `{ id, slug, titleEn, titleBn, shortDescriptionEn, shortDescriptionBn, descriptionHtmlEn, descriptionHtmlBn /* already sanitized */, youtubeUrl, brand: {slug,nameEn,nameBn}|null, breadcrumb: Crumb[] /* primary category path */, images: (ImageSet & {variantId: string|null})[], options: {position:1|2, nameEn, nameBn, values:{id,valueEn,valueBn,swatchHex}[]}[], variants: {id, sku, optionValue1Id, optionValue2Id, priceP, compareAtP, discountPct, available: number /* on_hand − reserved, min 0 */, isActive}[], specs: {nameEn,nameBn,unit,valueEn,valueBn}[], badges: Badges, isPreorder, preorderExpectedDate: string|null, isUpcoming, ratingAvg, ratingCount, soldCount, seoTitle, seoDescription, updatedAt }`.
- `GET /public/products/:slug/similar?limit=12` → `ProductCard[]` (same primary category first, then siblings; exclude self).
- `GET /public/products/cards?ids=<comma uuids, max 30>` → `ProductCard[]` in the given order (recently viewed, wishlist).
- `GET /public/sitemap` → `{ products: {slug, updatedAt}[], categories: {slug, updatedAt}[] }`.
- Existing: `GET /public/site` (settings incl. maintenance, announcement, shop_contact).

## Customer API contract (prefix `/v1/customer`, cookie `bdc_cs` httpOnly, SameSite=Lax, Secure in prod)

Errors: Nest exceptions with `{ message, code }` where code is stable (e.g. `PHONE_TAKEN`, `OTP_INVALID`, `OTP_EXPIRED`, `TOO_MANY_ATTEMPTS`, `INVALID_CREDENTIALS`, `NOT_VERIFIED`).

- `POST /customer/auth/otp` `{ phone, purpose: 'signup'|'reset' }` → `{ sentTo: string /* masked */, expiresInSec: number, resendInSec: number }`. 6-digit code, 5 min expiry, 5 attempts, resend cooldown 60 s, max 5/phone/hour + per-IP throttle (Redis). Reset for unknown phone: respond the same (no account enumeration) but send nothing.
- `POST /customer/auth/signup` `{ name, phone, email?, password, code }` → sets cookie, `{ customer: Me }`. Phone verified by the code. Password min 8.
- `POST /customer/auth/login` `{ login /* phone or email */, password }` → sets cookie, `{ customer: Me }`. Throttle like staff (5/login, 30/IP per 15 min).
- `POST /customer/auth/reset` `{ phone, code, password }` → `{ ok: true }`, revokes all sessions.
- `POST /customer/auth/logout` → clears cookie, revokes session.
- `GET /customer/me` → `Me = { id, name, phone, phoneVerified: boolean, email, lang: 'en'|'bn', createdAt }`; 401 if no session.
- `PATCH /customer/me` `{ name?, email?, lang? }` → `Me`. `POST /customer/me/password` `{ currentPassword, newPassword }`.
- `GET /customer/wishlist` → `{ items: (ProductCard & { addedAt: string })[] }`; `PUT /customer/wishlist/:productId` (idempotent add) → `{ ok: true }`; `DELETE /customer/wishlist/:productId`; `GET /customer/wishlist/ids` → `{ productIds: string[] }` (for hearts).
- Session: idle expiry = `customer_session_days` setting since last activity; sliding.

## Admin API contract (prefix `/v1/admin`, existing staff auth guard + permission decorator)

- `GET /admin/carousel` (`content.manage`) → `Slide[]` with media `{id,url,thumbUrl}`; `POST /admin/carousel`, `PATCH /admin/carousel/:id`, `DELETE /admin/carousel/:id`, `PUT /admin/carousel/order` `{ ids: string[] }`.
- Home feed weights: use existing `/v1/admin/settings` (`home_feed` key) — no new endpoint.
- Featured categories: existing categories `showOnHome` flag.

## Shop app (`apps/shop`, package `@bdc/shop`)

Next.js (latest stable, App Router, React 19), dev port **3100** (agents' extra dev servers: 3101–3109). API base from env `API_URL` (server, default `http://localhost:4000`) / `NEXT_PUBLIC_API_URL`. Data via `@bdc/api-client` (openapi-fetch) from server components; client components only where interaction needs it. Routes: `/` home, `/c/[...slug]` category (last segment slug), `/search?q=`, `/p/[slug]` product, `/login`, `/signup`, `/reset`, `/account/**`, `/wishlist`, and the same under `/bn/...`. Light/dark (system + toggle, no flash), EN/BN switch keeps the path.

---------------------------------------------------------------------------
# UPDATE (lead, wave 2): steps 4 and 7 run in parallel now (C31–C35)

Commits so far: 6eb812e (wave 0), 15e29ea (customer API, shop scaffold, admin carousel, step 4/7 schema). Shop scaffold conventions: read `apps/shop` (`src/lib/lang.ts`, `src/lib/api.ts`, `src/i18n/*`, `src/components/*`) — `routeParams`, `href(lang, path)`, `alternatesFor`, `dict(lang)`, `pick`, `apiGet`, `serverApi`, `browserApi`, CSS modules + `var(--*)` tokens, mobile ≤640px.

New decisions: C32 order no `YYMM-NNNNN` (sequence `order_no_seq`, never resets); SR memo `SR-YYMM-NNNNN` (`sr_memo_no_seq`); PO `PO-YYMM-NNNNN` (`po_no_seq`). C33 BD geo seeded from an open dataset. C34 portal uses Mantine like admin. C35 guest cart = server cart keyed by visitor cookie `bdc_vid`, merged into the customer cart on login.

New tables (migration 20261024095248, see schema.prisma bottom): Division/District/Upazila (Int ids from dataset), Area (optional), DeliveryZone (baseChargeP, baseWeightG, extraPerKgP, eta, freeAboveP null=never/0=always, isDefault one row), ZoneLocation (exactly one of district/upazila/area; most specific wins), CustomerAddress, Cart (+ partial unique: one live cart per customer / per visitor), CartItem (unique cart+variant), Order (+ snapshots, money in paisa), OrderItem, OrderStatusHistory, Payment, SrProfile, B2bShop, SrSale, SrSaleItem, B2bLedger (append-only trigger; only allowed UPDATE = confirming once), SrTarget, SrCommission, Supplier, VariantSupplier, PurchaseOrder, PurchaseOrderItem. Stock reasons already include order_reserve/order_release/sr_reserve/sr_release/sr_ship/po_receive — always change stock via `InventoryService.move(tx, …)` inside the same transaction.

New permissions: orders.view, orders.manage, delivery.manage, sr.portal, sr.approve, sr.manage, b2b.view, b2b.manage, suppliers.view, suppliers.manage, po.receive. New settings: `checkout` {guestOtpAboveP (default 500000 = ৳5000), maxQtyPerLine 10} (public), `sr_default_commission_bp` (100).

## Step 4 API contract (owner: agent A)

- Geo (public, cache 1 day): `GET /v1/public/geo/divisions` → `{id,nameEn,nameBn}[]`; `GET /v1/public/geo/districts?divisionId=` ; `GET /v1/public/geo/upazilas?districtId=` (same shape + parent id).
- Addresses (customer auth): `GET/POST /v1/customer/addresses`, `PATCH/DELETE /v1/customer/addresses/:id`, `PUT /v1/customer/addresses/:id/default`. Address = `{id,label,name,phone,districtId,upazilaId,areaId,line,landmark,isDefault, placeText /* "Upazila, District" in en */}`.
- Cart (guest or customer; cookie `bdc_vid` httpOnly 1 year set by the API when missing; customer session wins): `GET /v1/cart` → `Cart = { items: {variantId, productId, slug, titleEn, titleBn, optionsTextEn, optionsTextBn, image: ImageSet|null, qty, unitPriceP, compareAtP, priceAtAddP, priceChanged: boolean, available: number, maxQty: number, problem: null|'out_of_stock'|'qty_reduced'|'unavailable'|'upcoming'}[], count: number, subtotalP: number }`; `PUT /v1/cart/items/:variantId` `{qty}` (0 = remove) → Cart; `DELETE /v1/cart/items/:variantId` → Cart; `DELETE /v1/cart` → Cart. Login/signup merges guest cart (sum qty, capped).
- Checkout: `POST /v1/checkout/quote` `{ districtId, upazilaId, areaId? }` → `{ zone:{id,nameEn,nameBn,etaMinDays,etaMaxDays}, subtotalP, deliveryChargeP, deliveryDiscountP, grandTotalP, freeDeliveryRemainingP: number|null, guestOtpRequired: boolean, problems: string[] }`. `POST /v1/checkout/otp` `{phone}` (purpose guest_cod) → same as customer OTP response. `POST /v1/checkout/place` `{ addressId? | address:{name,phone,districtId,upazilaId,areaId?,line,landmark?}, guest?: {name, phone, email?}, otpCode?, note?, lang, idempotencyKey }` → `{ orderNo, orderId, grandTotalP, codDueP }`. Re-validates price/stock in one transaction, reserves stock (`order_reserve`), status `processing`, payment row `cod/full/initiated`, clears cart, sends SMS + email (if email) via SmsService/MailService. Errors with stable codes (`CART_EMPTY`, `CART_CHANGED`, `OUT_OF_STOCK`, `OTP_REQUIRED`, `OTP_INVALID`, `ADDRESS_INVALID`).
- Orders: `GET /v1/customer/orders?page=` → `{items:{orderNo,placedAt,status,grandTotalP,itemCount,firstImage}[] ,total}`; `GET /v1/customer/orders/:orderNo` → full order (items, money breakdown, ship-to, status history); `GET /v1/public/track?orderNo=&phone=` → order status timeline (no personal data beyond masked phone). Guest orders link to the account when the same phone is OTP-verified at signup (Q94).
- Admin: `GET/POST/PATCH/DELETE /v1/admin/delivery-zones` (+ locations) with `delivery.manage`; seed default zones (Inside Dhaka 60 ৳, Dhaka suburbs 100 ৳, Outside Dhaka 120 ৳ default) in seed-demo.

## Step 7 SR contract (owners: agent J api-sr, agent K portal)

All SR endpoints use the existing **staff** session + 2FA (SRs are staff, C13). Portal login = same `/v1/admin/auth/*` flow as admin.
- SR self (`sr.portal`, SR sees only own data, R17): `GET /v1/portal/sr/me` → `{ staff:{id,name}, profile:{area, commissionBp}, month:{targetP, soldP, collectedP, commissionP, dueOutstandingP} }`; `GET /v1/portal/sr/products?q=` → variant picker `{variantId, sku, titleEn, optionsText, image, priceP, available}[]`; `GET/POST /v1/portal/sr/shops` (`{name, ownerName?, phone, address, area?}`; new shops `isNew=true`, usable at once, Q119), `GET /v1/portal/sr/shops/:id` (with due balance + ledger); `GET/POST /v1/portal/sr/sales` (POST `{b2bShopId, items:{variantId, qty, unitPriceP}[], paidAtSaleP, note?}` → reserves stock `sr_reserve`, status submitted, memo no), `GET /v1/portal/sr/sales/:id`, `POST /v1/portal/sr/sales/:id/cancel` (only submitted); `POST /v1/portal/sr/collections` `{b2bShopId, amountP, method, note?}` → ledger row unconfirmed; `GET /v1/portal/sr/collections`.
- Admin (`b2b.view` read; `sr.approve` actions; `b2b.manage`; `sr.manage`): `GET /v1/admin/sr/sales?status=&srId=&shopId=` , `POST /v1/admin/sr/sales/:id/approve` (→ `sr_ship`? no: approve keeps reservation; `deliver` ships: `sr_release`+`sr_ship` or one `sr_ship` that moves reserved→shipped; pick one model, document it, test it), `/reject` `{reason}` (→ `sr_release`), `/deliver`; ledger: approve writes `sale_due` (= dueP) and, if paidAtSaleP>0, the payment is recorded on the sale (not a ledger collection); `GET /v1/admin/b2b/shops`, `PATCH /v1/admin/b2b/shops/:id` (incl. clear isNew, block), `GET /v1/admin/b2b/shops/:id/ledger`, `POST /v1/admin/b2b/ledger/:id/confirm`, `POST /v1/admin/b2b/shops/:id/adjust` `{amountP, note}`; `GET/PUT /v1/admin/sr/profiles/:staffId`, `GET/PUT /v1/admin/sr/targets?month=`, `POST /v1/admin/sr/commissions/compute?month=` (base = paidAtSale of sales approved in month + confirmed collections in month, Q120), `GET /v1/admin/sr/commissions?month=`, `POST /v1/admin/sr/commissions/:id/approve|paid`.
- `due_balance_p` cache updated in the same transaction as every ledger write; due = sum(amount_p) of sale_due + adjustments + confirmed collections (collections negative).
- Memo (R20): `GET /v1/portal/sr/sales/:id/memo` and admin equivalent → printable HTML (EN/BN by `?lang=`), print-friendly CSS; PDF later.

## Lead notes (wave 2)

- Commit e.g. after B: public browse API + carousel API are in; `pnpm api:gen` done, so `@bdc/api-client` has typed `/v1/public/*`, `/v1/customer/*`, `/v1/admin/carousel` paths. Shop: prefer `serverApi().GET(...)` now. `attr.<key>` filter params aren't typed; build those query strings by hand.
- **DTO class names must be globally unique** across the API (Swagger merges same-named classes → broke admin types once). Prefix new ones by area (`CartDto`, `SrSaleDto`, `PortalSrMeDto`...). grep before naming.
- **Tests: use your own throwaway database** so parallel agents don't collide on `bdc_test`: create `bdc_test_<agent>` and run with `TEST_DATABASE_URL=… TEST_REDIS_DB=<agent number 2-9>`; drop it when done (see `apps/api/test/helpers.ts` / vitest setup for how migrations are applied).
- `ProductCardService.cards(ids)` and `ImageService` are exported from `StorefrontModule` — reuse for any product card / cart line image.
- Don't run `pnpm api:gen` or `prisma migrate`; post on board, lead does it. If you need generated types before then, keep local types in one file marked `TODO(lead)`.

---------------------------------------------------------------------------
# WAVE 3 (lead)

State: everything up to 4276f4f is committed and pushed (step 3 storefront incl. e2e; step 4 backend; step 7 SR API + portal). `pnpm api:gen` done (91fdecb): cart/checkout/orders/geo/delivery/SR paths are typed in `@bdc/api-client`.

New decisions: C36 SR stock reserve on submit, deduct on deliver. C37 SRs see all active shops, ledger only own entries. C38 SR memo via public signed link. C39 portal EN+BN toggle. C40 delivery charge = max(zone charge, highest product override). C41 price change since add-to-cart: charge current price, no extra confirm (cart shows badge). C42 SR sale has per-sale delivery choice `deliveryBy` sr|staff; SR may mark own `sr` sales delivered; staff marks the rest. C43 staff can reject a pending collection (reason; never counted) and reverse an approved/delivered sale (status `reversed`, ledger type `reversal` cancelling remaining due, stock back via movements); ledger append-only.

New schema (migration 20261024140000, uncommitted until J's code compiles): `SrSale.deliveryBy` (enum SrDeliveryBy sr|staff, default staff), `reversedById/reversedAt/reverseReason`, `memoToken` (unique, nullable) + `memoTokenAt`; `SrSaleStatus.reversed`; `LedgerType.reversal`; `B2bLedger.rejectedById/rejectedAt/rejectReason`. DB trigger: a pending ledger row may be resolved once — confirm XOR reject — nothing else is updatable.

Step 4 API (agent A) notes for UI agents: cart cookie `bdc_vid` (httpOnly, set by API), session cookie `bdc_cs`; the shop's `/v1/*` rewrite makes browser calls same-origin. Server components that need cart/customer data must forward the request cookies (`serverApi({ cookie })`) and pages using them are dynamic. Error codes in `apps/api/src/orders/commerce.errors.ts` and `apps/api/src/customers/customers.errors.ts`. No default delivery zone in prod unless admin creates one (dev seed has 3 zones; NO_DELIVERY_ZONE otherwise).

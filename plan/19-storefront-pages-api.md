# Storefront pages: data contract for the redesign (frontend only)

Companion to `plan/18-storefront-redesign-prompt.md`. Written 2026-11-27 from the code in `apps/shop` and the OpenAPI types in `packages/api-client/src/schema.ts`. Every endpoint below was checked against the schema.

**Rule: the redesign changes UI only.** Use only the endpoints, fields and actions listed here. No new endpoints, fields, settings or migrations; we are heading to a test deployment. Anything that needs backend work goes into a "later" list, not into the build. Static or decorative content (icons, illustrations, fixed trust-strip copy) is fine. Re-check a field in `schema.ts` before using one this doc doesn't mention.

Prices are integer **paisa** (`…P` fields, e.g. `priceP`); format with `formatPrice` from `@bdc/i18n`. Bilingual text comes as `…En` / `…Bn` pairs (or `{en, bn}`); pick by the route's `lang`.

## Biggest traps (things a modern design usually assumes but we don't have)

- **No ratings or reviews.** `ratingAvg` / `ratingCount` exist but are never written (always 0). Hide stars, review counts, the ★ listing filter and `sort=rating` in the UI.
- **No delivery estimate on product or listing pages.** Zone ETA (`etaMinDays/etaMaxDays`) and `freeDeliveryRemainingP` come only from `POST /v1/checkout/quote` after an address is chosen. A "free-delivery progress bar" can only appear in checkout, not in the cart or cart drawer. Product pages may show static delivery copy.
- **No brand pages or brand logos.** Brands exist only as facets and search suggestions (link `/search?brand=<slug>`). A brand logo wall isn't possible.
- **One banner source:** the home carousel slides (`title`, `linkUrl`, `desktop`/`mobile` image sets). There is no separate promo-banner or split-banner content. Extra banner layouts must reuse slides (e.g. slides 2–3 as hero side tiles).
- **No newsletter or app endpoint.** Use the hotline/email from `GET /v1/public/site` → `contact` for a contact CTA.
- **Product cards have one image and no variant id.** No hover image swap; no add-to-cart from a card (cart calls need `variantId`, which only the product page has).
- **Stock:** exact `available` per variant on the product page only; cards get `outOfStock` only. "Only N left" is allowed on the product page.
- **Available but unused (free wins):** `soldCount`, `tags`, `warrantyEn/Bn`, dimensions, `preorderExpectedDate`, product coupons, flash `remaining` / `qtyLimit`, category `banner` and `icon`, `items[].image` in orders, zone name on order detail.

## Home (for reference; designed from the screenshots)

- `GET /v1/public/home?lang=` → `slides[]` {id, title, linkUrl, desktop, mobile}, `featuredCategories[]` (category nodes), `feedRowEvery?`.
- `GET /v1/public/categories/tree` → category menu.
- `GET /v1/public/feed` (server first page, client "load more") → product cards.
- `GET /v1/public/products/cards?ids=` → recently viewed / special rows (ids from localStorage).
- `GET /v1/public/flash-sales` → `{live[], upcoming[]}` for the flash strip and countdown.
- `GET /v1/public/site` → announcement bar (null outside its time window), contact, flags, maintenance.
- Tabbed rails like "New arrivals" or "Popular" are possible without backend work: `GET /v1/public/products?sort=newest|popular&limit=`.

## Catalog, content and auth pages

### Conventions (apply to every page)

- Server fetch: `apiGet()` in `lib/api.ts`. HTTP 404 returns `null` (caller calls `notFound()`). Other non-2xx throws `ApiHttpError`, which lands in `app/[lang]/error.tsx` (ErrorState + retry button).
- Browser calls go to same-origin `/v1/...` (rewritten to the API). Typed via `lib/api-browser.ts` (`browserApi`) and `call()` (`features/account/lib.ts`).
- Money is paisa (`priceP`, `compareAtP`) and shown with `formatPrice`. Listing URL `min`/`max` are taka; the API gets paisa (`minPrice = min*100`).
- Language: `/` = EN, `/bn/...` = BN. Every text field has `En` and `Bn` (Bn may be null; `pick()` falls back to English when Bn is empty).
- Layout (`app/[lang]/layout.tsx`) exports `revalidate = 60`. Pages that read `cookies()` or `searchParams` render per request.

---

### Shared shell (all pages)

Files: `app/[lang]/layout.tsx`, `components/shell/{AnnouncementBar,Header,UtilityBar,BottomNav,Footer,LangToggle,ThemeToggle,Maintenance,Logo}.tsx`, `features/browse/SearchBox.tsx`, `features/cart/CartCount.tsx`, `features/account/HeaderLinks.tsx`, `features/affiliate/RefCapture.tsx`, `features/pages/data.ts`.

| Part | Data / API | Fields shown | Actions |
|---|---|---|---|
| Layout site status | server `GET /v1/public/site` (`getSite`, revalidate 30; fails open to null) | `maintenance.enabled`, `maintenance.message{en,bn}`, `announcement{text{en,bn},link}` (null when outside window), `contact{hotline,email}`, `flags.*`, `customerOtpRequired` | none |
| Maintenance | from site | when `maintenance.enabled`, the whole shell (header, footer, nav) is replaced by a logo + title + message | none |
| AnnouncementBar | from site | `announcement.text` (lang pick); link `/...` internal or external | link if `announcement.link` set |
| UtilityBar (desktop only) | from site | hotline (`contact.hotline`) | `tel:` link; "Track order" -> `/track`; language and theme toggles |
| Header, desktop | `SearchBox` (client), wishlist (client), `CartCount` (client), `HeaderAccount` (client) | logo; search box; wishlist badge; cart badge; account label = first name | search submit -> `/search?q=`; links to `/wishlist`, `/cart`, `/account` or `/login` |
| Header, mobile | same | language toggle, theme toggle, cart with badge, search row (placeholder short) | same |
| SearchBox suggestions | client `GET /v1/public/search/suggest?q=` (q >= 2 chars, debounce 200 ms, API q 2-100) | `products[]` (slug, titleEn, titleBn, image.url320, priceP), `categories[]` (slug, nameEn, nameBn), `brands[]` (slug, nameEn, nameBn). API caps: products 6, categories 4, brands 4 | keyboard combobox. product -> `/p/{slug}`; category -> `/c/{slug}`; brand -> `/search?brand={slug}`; "See all results for q" -> `/search?q=` (no JS: plain GET form) |
| CartCount | client `GET /v1/cart` only when a cart hint cookie (`bdc_in` or cart hint) exists | count | link `/cart` |
| HeaderWishlist | client `GET /v1/customer/wishlist/ids` (logged-in only) | count badge | link `/wishlist` |
| HeaderAccount | client `GET /v1/customer/me` via `ensureSession` | first name of `me.name` | `/account` (logged in) or `/login` |
| Footer | server `GET /v1/public/pages` (footer pages only, revalidate 60; [] on failure) | company links: `slug`, `titleEn`, `titleBn`; contact `hotline`, `email` from site; fixed text: about, "We accept: COD" (hardcoded) | links to `/pages/{slug}`, `/track`, `tel:`, `mailto:` |
| BottomNav (mobile, <640px) | session (client) and cart count | 5 tabs: Home, Categories, Offers, Cart (badge), Account ("Login" label when logged out) | links |
| LangToggle | none | EN / BN | same path in the other language (`hrefLang` set) |
| ThemeToggle | none (client only) | light/dark | writes `bdc_theme` cookie (1 year); pre-paint script in layout reads it. No API |
| RefCapture (every page, client) | `POST /v1/public/affiliates/click` body `{code, landingUrl, utm?}` when URL has `?ref=` | none | none (fire-and-forget) |
| ServiceWorkerRegister | none | none | none |

---

### /categories (all categories)

- **Files:** `app/[lang]/categories/page.tsx`, `features/browse/api.ts` (`fetchCategoryTree`), `features/browse/Page.module.css`, `components/Breadcrumb.tsx`, `components/States.tsx`.
- **Rendering:** server component, ISR `revalidate = 300`. Public, no auth.
- **Data loaded:**
  - server `GET /v1/public/categories/tree` (no params), revalidate 300. Fails open to `[]`.
  - API returns active categories only (`isActive: true`), nested `children`.
- **Fields shown:**
  - Breadcrumb: Home > Categories.
  - H1: "Categories" (`pages.categories`).
  - One section per root node: `nameEn`/`nameBn` (heading link). Used: `id`, `slug`, `nameEn`, `nameBn`, `children`.
  - Under each root: a flat list of every descendant as links (`nameEn`/`nameBn`). Indentation class applied at depth > 2.
  - Not shown: `image`, `icon`, `chipColor`, `level`, product counts.
- **Actions:** every item is a link to `/c/{slug}`. No client JS, no API writes.
- **States:** empty tree (or API failure) shows `EmptyState` (generic title/body). No loading state (server rendered). No error state (failure is swallowed).
- **Notes:** no images and no counts are available. The whole tree is rendered on one page. Maximum tree depth is 4 per project notes; not enforced in this page (UNSURE: depth limit in API code not re-checked).

---

### /c/[...slug] (category listing)

- **Files:** `app/[lang]/c/[...slug]/page.tsx`; `features/browse/{api.ts, query.ts, Listing.tsx, Listing.module.css, FilterSheet.tsx, SortSelect.tsx, Pagination.tsx, types.ts, seo.ts, JsonLd.tsx}`; `components/{ProductGrid,ProductCard,Price,Img,Breadcrumb,States}.tsx`; `features/account/WishlistHeart.tsx`; `features/promotions/FlashTag.tsx` (inside ProductCard).
- **Rendering:** server component. Reads `searchParams`, so it renders per request. `export const revalidate = 60`; the API fetch is also `revalidate: 60`. Public, no auth.
- **Slug:** only the LAST segment is used as the category slug (`/c/a/b/c` uses `c`). Earlier segments are ignored.
- **Data loaded:**
  - server `GET /v1/public/products` with query (all optional except page/limit):
    - `category` = last slug segment
    - `page` (1-500 from URL; API max 1000)
    - `limit` = 24 fixed (API max 60)
    - `q` (URL max 100 chars; API max 200)
    - `brand` = CSV of brand slugs
    - `minPrice`, `maxPrice` (paisa; `maxPrice` only sent if > 0)
    - `rating` (int 1-5; UI offers 3 and 4 only)
    - `availability` = CSV of `in_stock|preorder|upcoming`
    - `sort` = `relevance|popular|newest|price_asc|price_desc|rating`
    - `attr.<key>` = CSV of option ids or `true`
  - Same call in `generateMetadata` (deduped by fetch cache).
  - API 404 (unknown or inactive category) -> `notFound()`.
- **Response used:** `items[]` (ProductCard), `total`, `page`, `limit`, `facets{brands[], price, availability, attributes[]}`, `category{id, slug, nameEn, nameBn, descriptionEn, descriptionBn, seoTitle, seoDescription, banner, breadcrumb[], children[]}`.
- **Fields shown:**
  - Breadcrumb: Home > each `breadcrumb[]` item (`nameEn`/`nameBn`, slug link except last).
  - Header block: H1 `category.nameEn`/`nameBn`; subtitle `descriptionEn`/`descriptionBn` (only if non-empty). `category.banner` is NOT rendered (used only for OG image metadata `banner.url1200`).
  - Subcategory tiles (`children[]`): `image` (ImageSet, 64px, placeholder when null), `nameEn`/`nameBn`, link to `/c/{slug}`.
  - Result count: `total` ("1 result" or "N results").
  - Filter sidebar (`FilterSheet` on mobile):
    - Availability checkboxes with counts: `facets.availability.in_stock|preorder|upcoming`.
    - Price: two number inputs (taka) with placeholders from `facets.price` (floor(min/100), ceil(max/100)).
    - Brand checkboxes with counts: `facets.brands[]` (`slug`, `nameEn`/`nameBn`, `count`). Shown only when more than 1 brand, or a brand is selected.
    - Rating radios: Any, 4+ (★), 3+ (★).
    - Attribute groups: one per `facets.attributes[]` (name, `unit` in title, options with `valueEn`/`valueBn`, `count`). Open by default only when that attribute is selected.
  - Active filter pills: price range, brand name (from facets), rating, availability label, attribute option values; plus "Clear all".
  - Sort select: options from `sort` list. `relevance` only offered when `q` is set. Default `popular` (no q).
  - Product grid (`ProductCard` per item, see "ProductCard fields" below). Compact grid, max 4 columns, first 4 images eager.
  - Pagination: `ceil(total/24)` pages; numbered links with first/last and neighbours, prev/next links with `rel`.
  - Empty result: heading + body (no-match text if filters applied, else no-results text).
- **Actions:**
  - Filter form: GET to the same URL with params. No client API call. "Show N results" submit button; "Apply" for price.
  - Remove pill: link (GET). "Clear all": link (GET).
  - Sort select: auto-submits (GET) on change; keeps other params, resets page.
  - Pagination links (GET).
  - Product card link -> `/p/{slug}`.
  - Wishlist heart per card (see ProductCard). Logged out -> `/login?next=`; logged in -> `PUT|DELETE /v1/customer/wishlist/{productId}` (client, optimistic).
  - Mobile filter sheet open/close: client only.
- **States:**
  - 404 (unknown/inactive category) -> Next `notFound()`.
  - Empty results -> `EmptyState`-style block.
  - API error -> `error.tsx` (ErrorState + retry).
  - Out of stock: card overlay "Out of stock" (dimmed).
  - No loading skeleton (server rendered).
- **Notes:**
  - Filtered or sorted pages are `noindex, follow` (`isFiltered`). Page 2+ unfiltered keeps `?page=` canonical.
  - Attribute facets exist only in a category listing (API computes them only when `category` is set).
  - Rating filter means `rating_avg >= n`. Ratings are never written (see "Not available"), so 3+ and 4+ filters return no items today.
  - `sort=rating` orders by `rating_avg` (all zero today, so the order is by `rating_count` then id).
  - Facets: price range comes from the filtered set (`min`/`max` of variant prices).
  - Brand facet query has no `LIMIT` in code (checked the 12 lines after its declaration; UNSURE whether a cap exists elsewhere).

---

### /search (+ header SearchBox suggestions)

- **Files:** `app/[lang]/search/page.tsx`; `features/browse/{api.ts, query.ts, Listing.tsx, SearchBox.tsx, SearchBox.module.css, types.ts}`; `components/States.tsx`; `components/ProductCard`, `Price`, `Img`.
- **Rendering:** server component, per request (reads `searchParams`). `robots: noindex, follow` always. Public, no auth. API fetch revalidate 60.
- **Data loaded:**
  - Page: server `GET /v1/public/products` with the same query params as the category listing, but no `category`. Called only when `q` or `brand` is present; otherwise the prompt state is shown with no API call.
  - Suggestions: client `GET /v1/public/search/suggest?q=` (see Shell table). Response `{products[], categories[], brands[]}`.
- **Fields shown (results):**
  - Breadcrumb: Home > Search.
  - H1: `Search for "{q}"`, or the single brand name when only a brand filter is set (`Brand: {name}`), or "Search".
  - Same filter sidebar, pills, sort, grid, pagination as the category page. Differences:
    - No `attr.*` facets (no category).
    - Sort default `relevance` when `q` is set, else `popular`. Relevance option shown only with `q`.
    - The filter form keeps `q` as a hidden field.
  - ProductCard fields: see below.
- **Fields shown (suggestions):** product: `image.url320`, `titleEn`/`titleBn`, `priceP` formatted. Category: name. Brand: name. Group headings: products, categories, brands. "None" text when empty.
- **Actions:**
  - Submit header form -> `GET /search?q=...` (works without JS).
  - Arrow keys/Enter/Escape in the combobox; Enter on a suggestion navigates to its href.
  - Suggestion links: product `/p/{slug}`, category `/c/{slug}`, brand `/search?brand={slug}`, "all" `/search?q=`.
  - Filters, sort, pagination: as on the category page (GET).
- **States:**
  - No `q` and no `brand`: EmptyState prompt (`searchPrompt`, `searchPromptBody`).
  - No results: no-match or no-results text.
  - Suggestions: "none" text when a query returns nothing; panel hidden below 2 characters.
  - API error -> `error.tsx`.
- **Notes:**
  - Ranking: full-text rank plus trigram word similarity on title and brand (typo tolerance). Default sort with `q` is relevance, tie-broken by `sold_count`.
  - Suggestion caps: 6 products, 4 categories, 4 brands.
  - Search query is trimmed and cut at 100 chars in the shop, 200 in the API.

---

### /p/[slug] (product detail)

- **Files:** `app/[lang]/p/[slug]/page.tsx`; `features/browse/{api.ts, ProductView.tsx (client), logic.ts, cart-actions.ts, ShareRow.tsx, ProductRow.tsx, RecentlyViewed.tsx, YouTubeLite.tsx, JsonLd.tsx, seo.ts, types.ts}`; `features/promotions/{CouponsSection.tsx, CouponCard.tsx, FlashBox.tsx, Countdown.tsx, logic.ts}`; `features/account/WishlistHeart.tsx`; `features/cart/store.ts`; `components/{Price,Img,Breadcrumb,ProductCard}.tsx`.
- **Rendering:** ISR. `revalidate = 60`, `generateStaticParams()` returns `[]` (rendered on first request, then cached). Product fetch revalidate 60; similar fetch revalidate 300. Client components: ProductView (gallery and buy box), RecentlyViewed, ShareRow, CouponsSection, WishlistHeart. Public, no auth required to view.
- **Data loaded:**

| When | Call | Notes |
|---|---|---|
| server | `GET /v1/public/products/{slug}` | 404 -> `notFound()` |
| server | `GET /v1/public/products/{slug}/similar?limit=12` | fails open to `[]` |
| client, on mount | `GET /v1/public/products/{slug}/coupons` | in CouponsSection; runs for anonymous and logged-in visitors |
| client, on mount | `GET /v1/public/products/cards?ids=` (up to 12 ids from localStorage) | RecentlyViewed |
| client, on Add/Buy | `GET /v1/cart` (refreshCart), then `PUT /v1/cart/items/{variantId}` body `{qty}` | qty is absolute: `min(current + qty, max(cap, current))` |
| client, on mount | `GET /v1/customer/wishlist/ids` (logged in only) | hearts |
| client, on heart | `PUT` or `DELETE /v1/customer/wishlist/{productId}` | logged out -> `/login?next=` |
| client, on coupon | `POST /v1/customer/coupons/{couponId}/collect` | logged in only |

- **Fields shown:**
  - Breadcrumb: Home > `breadcrumb[]` > title. `breadcrumb[]` items: `slug`, `nameEn`, `nameBn`.
  - Header: `titleEn`/`titleBn` (H1). Rating line: `ratingAvg`, `ratingCount` (star row + "(N reviews)") only when `ratingCount > 0`, otherwise "No reviews yet" text. `soldCount` (compact) when > 0. `brand` {slug, nameEn, nameBn}: link to `/search?brand=`. `shortDescriptionEn`/`Bn`. Share row.
  - Badges on gallery: `badges.isNew`, `isPreorder`, `isUpcoming`.
  - Gallery: `images[]` (ImageSet `url320`, `url640`, `url1200`, `width`, `height`, `alt`, `variantId`). Main image + counter "N / M" + thumbnail row (only when > 1 image). Selecting a variant jumps to the first image whose `variantId` matches.
  - Price block (selected variant): `priceP`, `compareAtP`, `discountPct` (strike-through and "-N%" when `compareAtP > priceP`), savings text `compareAtP - priceP`.
  - Flash box (selected variant `flash`): `endsAt` countdown; "only N left" when `remaining <= 10`; per-customer limit `perCustomerLimit`.
  - Options: for each `options[]` (position 1 or 2, `nameEn`/`nameBn`): buttons for each `values[]` (`valueEn`/`valueBn`). Swatch buttons when `swatchHex` is set, text buttons otherwise.
  - Stock line (selected variant `available`, `isPreorder`, `preorderExpectedDate`, `isUpcoming`):
    - upcoming: "upcoming" text.
    - no variant: "unavailable".
    - preorder: expected date text (date formatted from `preorderExpectedDate`) or generic preorder text.
    - `available <= 0`: out of stock.
    - `available <= 5`: "only N left" (the exact number is shown ONLY in this range).
    - otherwise: "in stock" (no number).
  - SKU: `variants[].sku` of the selected variant, "SKU: ...".
  - Preorder note text (`isPreorder`).
  - Description: `descriptionHtmlEn`/`Bn` (API-sanitized HTML). Section hidden when empty.
  - Specs table: `specs[]` (`nameEn`/`nameBn` row header, `valueEn`/`valueBn` + `unit`); plus `warrantyEn`/`Bn` row; plus dimensions row from `lengthMm`/`widthMm`/`heightMm` (mm) when all three present. Section hidden when none.
  - Tags: `tags[]` chips linking to `/search?q={tag}`.
  - Video: `youtubeUrl` (watch, youtu.be, embed, shorts forms; others ignored).
  - Similar products row: ProductCard list (heading "similar"). Hidden when empty.
  - Recently viewed row: ProductCard list. Hidden when empty.
  - Coupons block (CouponsSection with `slug`): hidden when list empty (no empty text on this page).
  - Metadata: `seoTitle`/`seoDescription`, OG image `images[0].url1200`, JSON-LD Product (price, offers, availability, aggregateRating only if `ratingCount > 0`) and BreadcrumbList.
  - Variant-level fields used: `id`, `sku`, `optionValue1Id`, `optionValue2Id`, `priceP`, `compareAtP`, `discountPct`, `flash`, `available`, `isActive`.
- **Actions:**

| Action | Effect |
|---|---|
| Pick option value | Client only (`logic.ts`): selects variant; values with no active variant are disabled; sold-out values stay enabled with sr-only "sold out" text |
| Gallery thumbnail | Client only (changes main image) |
| Quantity stepper | Client only. Min 1, max `min(available, 10)`; preorder max 10 |
| Add to cart | `GET /v1/cart` then `PUT /v1/cart/items/{variantId}` `{qty}`; toast "added", link to cart |
| Buy now | Same as Add, then navigates to `/cart` |
| Pre-order now (preorder products) | Same as Buy now |
| Wishlist heart | Logged out: `/login?next=<this page>`. Logged in: `PUT`/`DELETE /v1/customer/wishlist/{productId}` |
| Share | Native share sheet (`navigator.share`) when available; else copy link (clipboard); WhatsApp (`wa.me`) and Facebook sharer external links. No API |
| Copy coupon code | Client clipboard |
| Collect coupon | `POST /v1/customer/coupons/{couponId}/collect` (409 = already collected). Logged out shows login link with `next` |
| Brand link, tag chips, breadcrumb | GET navigation |
| Similar / recent cards | Card link `/p/{slug}`; heart per card |

- **States:**
  - Not found / unpublished / inactive / no active variant: 404 (`notFound()`).
  - Upcoming product: no cart controls; upcoming note + wishlist heart only.
  - Preorder: "Pre-order now" button; expected-date stock text.
  - Out of stock (selected variant): disabled "Out of stock" button; stock text out of stock.
  - No variant matches the option choice: "unavailable" stock text and disabled button (`!orderable`).
  - Cart failures: flash limit message with remaining units (`FLASH_LIMIT`, `remaining`) or generic "cart failed"; toast auto-hides after 4 s.
  - Busy state disables add/buy buttons while the request runs.
  - No loading skeleton for similar/recent (rows appear when data arrives; hidden when empty).
- **Notes:**
  - Delivery information: NOT on this page. No delivery zone, ETA or fee field in the product API, and the shop product files contain no delivery text.
  - Stock: exact per-variant `available` is in the API, but the UI shows an exact count only at 5 or fewer.
  - Reviews and rating: fields exist (`ratingAvg`, `ratingCount`) but are never written (always 0). Rating UI is effectively hidden.
  - Similar products: same primary category or its sibling categories; ordered by same-category first, then `sold_count`; API max 30.
  - Product and flash data are ISR (up to 60 s stale). A new flash sale or a stock change can lag.
  - Video supports YouTube URLs only (`youtubeId` parser).

---

### /offers

- **Files:** `app/[lang]/offers/page.tsx`; `features/promotions/{api.ts, FlashSales.tsx, Countdown.tsx, CouponsSection.tsx, CouponCard.tsx, logic.ts, types.ts, promotions.module.css}`; `components/{ProductCard,States}.tsx`.
- **Rendering:** server component. Page does not export `revalidate`, so the layout's 60 s applies (UNSURE on the effective value). Both fetches are `revalidate: 30`. Public, no auth. Client parts: CouponsSection (refetch for logged-in visitors), CouponCard (copy and collect).
- **Data loaded:**
  - server `GET /v1/public/flash-sales` -> `{live[], upcoming[]}` (fails soft to null).
  - server `GET /v1/public/coupons` -> `{items[]}` (fails soft to null).
  - client, logged in only: `GET /v1/public/coupons` (fresh copy with `collected` flags).
  - client: `POST /v1/customer/coupons/{couponId}/collect`.
- **Fields shown:**
  - H1 "Offers", intro text.
  - Each live sale (`live[]`): `nameEn`/`nameBn`, countdown to `endsAt`. Items (`items[]`): `productCard` (all ProductCard fields; `priceP` is the live flash price, per the API type comment), `remaining` ("N left" when <= 10). Not rendered: `flashPriceP`, `qtyLimit`, `variantId`.
  - Upcoming sales (`upcoming[]`): `nameEn`/`nameBn`, countdown to `startsAt`, up to 6 product cards. No remaining count.
  - Coupons (`items[]`): `name`, `kind` (`code` or `auto`), `code`, `type` (`percent|fixed|free_delivery|bxgy|tiered|bundle`), `value`, `maxDiscountP`, `minOrderP`, `startsAt`, `endsAt`, `termsEn`/`termsBn`, `isCollectable`, `collected`. Value and facts text are derived in `promotions/logic.ts`.
- **Actions:**
  - Product card link -> `/p/{slug}`.
  - `code` coupon: copy button (clipboard).
  - `auto` coupon: "applied automatically" text, no action.
  - Collectable coupon: "Collect" button (`POST .../collect`); logged out -> "log in to collect" link to `/login?next=/offers`; collected -> "Collected" label.
- **States:**
  - Both flash and coupons fail: ErrorState with `loadError` text.
  - No live sales: flash empty text. Upcoming section shown only if non-empty.
  - No coupons: empty text (CouponsSection with `empty`).
  - Collect error and copy failure: role=status note text.
- **Notes:**
  - Flash sales are per-variant; a product can appear in several sales over time.
  - No pagination; no filters on this page.
  - Coupon list is public; per-product coupons are a separate endpoint (product page).

---

### /wishlist

- **Files:** `app/[lang]/wishlist/page.tsx`; `features/account/{server.ts, WishlistGrid.tsx, wishlist-store.ts, WishlistHeart.tsx, SessionSeed.tsx, account.module.css}`; `components/{ProductGrid,ProductCard,States}.tsx`.
- **Rendering:** server component, dynamic (session cookie). Auth required: `requireCustomer` redirects to `/login?next=/wishlist`. `robots: noindex`.
- **Data loaded:**
  - server `GET /v1/customer/wishlist` (session cookie forwarded, no cache) -> `{items[]}`. Items use the ProductCard shape (`id`, `slug`, `titleEn`, `titleBn`, `image`, `priceP`, `compareAtP`, `discountPct`, `flashEndsAt` verified; the remaining item fields were not re-checked).
  - server `GET /v1/customer/me` (session check, through `getCustomer`).
  - client: `GET /v1/customer/wishlist/ids` (seeds the heart state from the list; no extra call on this page).
  - client: `DELETE /v1/customer/wishlist/{productId}` on remove.
- **Fields shown:** ProductCard fields for each item (image, title, price, struck price and discount, badges, out-of-stock overlay, sold text when > 0 and rating when `ratingCount > 0`). Remove button (×) replaces the heart on each card.
- **Actions:**
  - Remove: optimistic removal, then DELETE; rolls back on failure.
  - Card link -> `/p/{slug}`.
  - No add-to-cart from this page.
- **States:**
  - Logged out: redirect to login with `next`.
  - Empty: "Your wishlist is empty" + body + "Continue shopping" (home).
  - API error: `error.tsx`.
- **Notes:** no pagination, no sort, no per-item stock message beyond card badges. `items` order is whatever the API returns (not checked).

---

### /pages/[slug] (CMS static page)

- **Files:** `app/[lang]/pages/[slug]/page.tsx`; `features/pages/{data.ts, logic.ts, pages.module.css}`; `components/Breadcrumb.tsx`; `features/browse/seo.ts` (`plainText`).
- **Rendering:** server component, ISR `revalidate = 60`, `generateStaticParams()` returns `[]`. Public, no auth.
- **Data loaded:**
  - server `GET /v1/public/pages/{slug}` (fetch revalidate 60). Returns only published pages; unknown or unpublished -> 404 -> `notFound()`.
  - Footer (on every page): `GET /v1/public/pages` (only pages flagged show-in-footer).
- **Fields shown:**
  - Breadcrumb: Home > title.
  - H1: `titleEn`/`titleBn` (language pick, English fallback).
  - Body: `bodyHtmlEn`/`bodyHtmlBn` (API-sanitized HTML; falls back to the other language when the current one is empty).
  - Metadata only: `seoTitle`, `seoDescription`. `updatedAt` is not shown.
- **Actions:** breadcrumb link to home only.
- **States:** 404 for unknown/unpublished pages. No loading or error UI beyond the global error boundary. Empty body shows an empty section.
- **Notes:** no images, no table of contents, no author or date. Any published page is reachable by URL; only footer-flagged pages appear in the footer.

---

### /[...rest] (404)

- **Files:** `app/[lang]/[...rest]/page.tsx`; `app/[lang]/not-found.tsx` (client); `components/States.tsx` (`NotFoundState`).
- **Rendering:** server. Calls `notFound()`, which renders `not-found.tsx` inside the shell. Language comes from the browser path (`usePathname`).
- **Data loaded:** none.
- **Fields shown:** title (`states.notFoundTitle`), body (`states.notFoundBody`), button "home" (`/`).
- **Actions:** home button. Header and search still work (shell).
- **States:** this page is also the 404 for `notFound()` calls on product, category and CMS pages.
- **Notes:** no suggestions, no product or category links, no search box in the content area (header search only).

---

### /login

- **Files:** `app/[lang]/login/page.tsx`; `features/account/{LoginForm.tsx, lib.ts (safeNext, call, errorMessage), server.ts (getCustomer), api.ts, account.module.css}`; `lib/api-browser.ts`.
- **Rendering:** server, dynamic (session cookie). Logged in -> redirect to `next`. `robots: noindex`.
- **Data loaded:**
  - server `GET /v1/customer/me` (through `getCustomer`).
  - client `POST /v1/customer/auth/login` body `{login, password}`. `login` is the email as typed, or the phone normalised (Bangla digits and +880 handled).
- **Fields shown:** none from the API. Form labels and errors only.
- **Form fields:** login (email or phone; hint text), password. Links: forgot password (`/reset`), sign up (`/signup`, keeps `next`).
- **Actions:**
  - Submit: login; on success `router.replace(next)` then `router.refresh()`. `next` is validated by `safeNext` (defaults to `/account`).
- **States:** client validation messages (login required, password required); API error text mapped by `errorMessage`; busy label.
- **Notes:** password login only. No OTP login, no social login.

---

### /signup

- **Files:** `app/[lang]/signup/page.tsx`; `features/account/{SignupForm.tsx, ResendRow.tsx, api.ts, lib.ts}`.
- **Rendering:** server, dynamic (session cookie). `robots: noindex`. Logged in -> redirect to `next`.
- **Data loaded:**
  - server `GET /v1/customer/me` (session check).
  - server `GET /v1/public/site` (via `getSite`): `customerOtpRequired` (absent or true = OTP required).
  - client `POST /v1/customer/auth/otp` body `{phone, purpose: "signup"}` -> `{sentTo, resendInSec}`.
  - client `POST /v1/customer/auth/signup` body `{name, phone, email?, password, code?}`.
  - client resend: same OTP call, countdown `resendInSec`.
- **Fields shown:**
  - Step 1 form: name, phone, email (optional), password.
  - Step 2 (OTP on): code box, text "code sent to {sentTo}", resend countdown.
  - When OTP is not required: single step, button "create account".
- **Actions:** send code (step 1), create account (step 2), resend code, login link (keeps `next`). On success `router.replace(next)` and `router.refresh()`.
- **States:** API errors via `errorMessage`; busy state; resend countdown.
- **Notes:** the account is created only after the code is confirmed (when OTP is on).

---

### /reset

- **Files:** `app/[lang]/reset/page.tsx`; `features/account/{ResetForm.tsx, ResendRow.tsx, api.ts}`.
- **Rendering:** server page with no session or cookie read (static from the page's point of view); `robots: noindex`. Layout revalidate applies (UNSURE).
- **Data loaded:**
  - client `POST /v1/customer/auth/otp` body `{phone, purpose: "reset"}` -> `{sentTo, resendInSec}`.
  - client `POST /v1/customer/auth/reset` body `{phone, code, password}`.
- **Fields shown:** phone; after the code is sent, "code sent to {sentTo}", code box, new password; resend countdown.
- **Actions:** send code, submit code and new password, resend.
- **States:** success notice (`resetDone`) after the reset call (no redirect); API errors via `errorMessage`; busy state; resend countdown.

---

### Not available from the API

Checked against the public endpoints above (`/v1/public/*`, plus the customer wishlist and coupon endpoints these pages use).

- **Product ratings and reviews:** `ratingAvg` and `ratingCount` are returned but never written (no review module, no writer in `apps/api`). Always 0 today. No review text, author, date, photos, or Q&A.
- **Rating distribution (5-star breakdown):** not available.
- **Review count with real data:** same as above; not available in practice.
- **Sold count:** available (`soldCount`, updated on order placed and reversed on cancel).
- **View count:** stored in the DB (used for sort) but NOT returned.
- **Stock count:** exact per-variant `available` is returned on the product page. Listing and wishlist cards give only the `outOfStock` boolean. The UI shows the exact count only at 5 or fewer.
- **Stock per warehouse or location:** not available.
- **Delivery estimate or fee per area, on product or listing pages:** not available (checkout uses separate endpoints, not covered here).
- **Return policy per product:** not available.
- **Seller or vendor info (name, rating, store page):** not available (single seller, no seller fields in product detail).
- **Brand pages:** no brand endpoint (no brand detail, brand logo, or brand description). Brands appear only as facets and suggestions, linking to `/search?brand=`.
- **Brand logo or banner:** not available.
- **Category banner image:** returned as `category.banner` but NOT rendered on `/c/...` (metadata only).
- **Category icon:** returned in the tree (`icon`) but not used on these pages.
- **Category product count:** not available (no count field in the tree).
- **Size guide:** not available.
- **Weight:** not available (dimensions `lengthMm`, `widthMm`, `heightMm` only).
- **Multiple home or promotional banners:** not on these pages (the home carousel is a separate endpoint, out of scope).
- **Related products beyond "similar":** only the similar list (same primary category or sibling). No cross-sell, bundles, or "customers also bought".
- **Frequently bought together, recommendations for a user:** not available.
- **Q&A and questions:** not available.
- **Video gallery (multiple videos):** only one `youtubeUrl`, YouTube only.
- **Product-level coupons:** available (`GET /v1/public/products/{slug}/coupons`), listed in the Coupons block.
- **Price history:** not available.
- **Search facet for rating counts:** only the filter exists; no per-rating counts in facets.
- **Trending or popular searches, recent searches (server side):** not available.
- **Spelling correction ("did you mean"):** not available (typo tolerance only).
- **Search suggestion for a single brand page or pagination in suggestions:** not available (caps 6/4/4).
- **Next/previous product links:** not available.
- **Wishlist count per product (how many saved it):** not available.
- **CMS pages list (all pages, not just footer):** not available; `GET /v1/public/pages` returns footer-flagged pages only.
- **CMS page last-updated date and author:** `updatedAt` returned but not shown; no author.
- **Pre-order expected date:** available (`preorderExpectedDate`).
- **Flash sale quantity sold or total:** `remaining` and `qtyLimit` returned on flash items; the shop shows only `remaining` (and only at 10 or fewer). Product page flash shows `remaining` and `perCustomerLimit`.
- **Product tags:** available (`tags`).
- **Warranty:** available (`warrantyEn`/`warrantyBn`).
- **Product images beyond 3 sizes:** each image has width, height, alt and variant link; no video or 360 images.
- **Accessibility text (alt) per image:** `alt` available (may be null).
- **Store contact per product, store hours:** not available (`contact` is shop-level: hotline and email only).
- **Social media links:** not available.
- **Live chat:** not available.
- **Order tracking from product pages:** not on these pages (separate `/track` page).
- **Affiliate or referral data on product pages:** only `?ref=` capture (click call); no stats on these pages.

## Account, order and checkout pages

### Global rules (apply to every page below)
- Server calls: `serverApi({cookie})` (lib/api.ts), cookie forwarded, `cache: no-store`. Forwarded cookies: `bdc_cs` (customer session, httpOnly); cart also gets `bdc_vid`.
- Browser calls: `browserApi` (lib/api-browser.ts), same-origin `/v1` (rewritten to API). Results wrapped by `call()` (features/account/lib.ts) into `{ok, data} | {ok:false, status, code, message, retryAfterSec?}`. `code` = API error code or `NETWORK`.
- `requireCustomer(lang, path)` (features/account/server.ts): no session -> redirect `/login?next=<href(path)>`. getCustomer() = GET /v1/customer/me, 401 -> null.
- All account/order/returns pages: robots noindex.
- Money display: `formatPrice(p, lang)`. Dates: `formatDateTime` (Asia/Dhaka).
- Shared components: `Timeline`, `ShipmentCards`, `CancelOrder`, `DiscountList`, `Img`, `EmptyState`, `ErrorState`, `Notice`, `Field`, `LoadBox`, `StatTile`.

### Common DTO: OrderStatus enum (OrderListDto/OrderDetailDto/OrderTrackDto)
`pending_payment | processing | on_hold | partially_shipped | shipped | delivered | completed | cancelled | delivery_failed | failed`
Labels (features/orders/strings.en.ts): Awaiting payment | Processing | On hold | Partly shipped | Shipped | Delivered | Completed | Cancelled | Delivery failed | Delivery failed (failed and delivery_failed share a label; `failed` also has a "final" note).
ShipmentStatus enum: `preparing | with_courier | in_transit | delivered | failed | returning | returned` -> Getting ready | With courier | On the way | Delivered | Delivery failed | Returning to us | Returned to us. Badge red for failed/returning/returned.
PaymentStatus is a free `string` in DTO; labels exist only for `unpaid` (To pay on delivery), `paid`, `partially_paid`, `refunded`, `partially_refunded`; others shown raw.
paymentMethod: `cod` -> COD label; other values shown raw.

---

### /account (dashboard)
- Files: `app/[lang]/account/page.tsx`; `features/account/{ProfileForm,PasswordForm,LogoutButton,SessionSeed,server}.tsx|ts`
- Rendering: server page (requireCustomer); client forms/islands.
- Auth: required. Guest -> /login?next=/account.
- Data loaded:
  - `GET /v1/customer/me` (server, via getCustomer in requireCustomer). No query.
- Fields shown (CustomerMeDto):
  - Header: `name` (string) in "Hello {name}".
  - Profile form: `name`, `email` (string|null), `lang` ('en'|'bn'), `phone` (string|null, read-only, disabled).
  - Not rendered: `id`, `phoneVerified`, `createdAt`.
- Tiles (static, no data, no counts): Orders `/account/orders`; Returns `/account/returns`; Coupons `/account/coupons`; Affiliate `/account/affiliate`; Addresses `/account/addresses`; Wishlist `/wishlist`.
- Actions:
  - Save profile: `PATCH /v1/customer/me` body `UpdateCustomerDto` {name, email (string|null), lang}. Phone is NOT sent (not editable). If lang changed -> router.push `/{newLang}/account`; else router.refresh().
  - Change password: `POST /v1/customer/me/password` body `CustomerChangePasswordDto` {currentPassword, newPassword}. Client rule: new password >= 8 chars.
  - Logout: `POST /v1/customer/auth/logout` (no body), then router.replace(`/`).
- States: redirect to login when logged out. Form-level error/success notices (texts in strings).
- Notes: dashboard has no order/return/wallet summary; only the tiles. No way to change phone.

### /account/orders
- Files: `app/[lang]/account/orders/page.tsx`; `features/orders/OrderList.tsx`, `types.ts`, `format.ts`, `orders.module.css`
- Rendering: server. Auth: required.
- Data loaded:
  - `GET /v1/customer/orders` (server) query: `page` (from `?page=`, min 1). `limit` not sent (API default; read back from response).
- Fields shown (OrderListDto):
  - `items[]`: `orderNo` (string), `placedAt` (string), `status` (enum), `grandTotalP` (int), `itemCount` (int), `firstImage` ({alt, width, height, url320, url640, url1200} | null) rendered 64px thumb.
  - `total`, `page`, `limit` -> pager (pages = ceil(total/limit)).
- Actions:
  - Row -> `/account/orders/{orderNo}`.
  - Prev/next -> `?page=page±1`.
- States:
  - Empty (`items` = []): EmptyState listEmpty + CTA to `/`.
  - API error: ErrorState loadError.
  - Pager only if pages > 1.
- Notes: no status filter, no search, no date filter (API exposes only `page`, `limit`). Not in API: none needed for list beyond the fields above.

### /account/orders/[orderNo]
- Files: `app/[lang]/account/orders/[orderNo]/page.tsx`; `features/orders/{OrderDetailView,CancelOrder,ShipmentCards,Timeline,format}.tsx|ts`; `features/returns/logic.ts` (canViewInvoice, canRequestReturn); `features/promotions/DiscountList.tsx`; `features/checkout/eta.ts` (etaText).
- Rendering: server page; CancelOrder is client.
- Auth: required (requireCustomer path `/account/orders/{orderNo}`).
- Data loaded:
  - `GET /v1/customer/orders/{orderNo}` (server, path param). 404 -> "not found" state; other error -> loadError.
- Fields shown (OrderDetailDto):
  - Header: `orderNo`, `placedAt`, `status`, badge.
  - Timeline: `history[]` {status, at} (oldest first; last = current).
  - ETA line (only when status = processing): `zone.etaMinDays`, `zone.etaMaxDays`.
  - Notes: status = delivery_failed / failed / on_hold show fixed notes. `customerNote` (string|null) shown as "Note".
  - Items: `items[]`: `variantId` (key), `slug` (link `/p/{slug}`), `title`, `optionsText` (string|null), `image` (thumb), `qty`, `qtyCancelled` (shown "(N cancelled)" when > 0), `unitPriceP`, `lineTotalP`, `discountP` (shown as minus when > 0).
    - Not rendered: `orderItemId`, `productId`, `sku`, `returnableQty` (used only by return link logic).
  - Shipments (ShipmentCards, shown only if `shipments` non-empty): `shipmentNo`, `status`, `courier` {code, name} | null (name shown), `trackingId` (shown with courier), `trackingUrl` (only http/https, button "Track"), `handedAt`, `deliveredAt`, `items[]` {title, qty}.
    - Not rendered: `courier.code`.
  - Summary: `discounts[]` via DiscountList (`name`, `code`, amount = amountP + deliveryP, freeDelivery = deliveryP > 0; `couponId`, `kind`, `type` not rendered).
  - Money (`money`): `subtotalP`, `autoDiscountP` (if > 0), `couponDiscountP` (if > 0), `deliveryChargeP`, `deliveryDiscountP` (if > 0), `grandTotalP`, `paidP` (if > 0), `refundedP` (if > 0), `codDueP` (always).
  - Payment line: `paymentMethod`, `paymentStatus` (see global labels).
  - Ship-to (`shipTo`): `name`, `phone`, `line`, `placeText`, `landmark` (if set).
  - Not rendered: `isPreorder`, `lang`, `zone.nameEn/nameBn`, `zone` name, `items[].productId/sku/orderItemId`.
- Actions:
  - Cancel (only if `canCancel`): button -> inline confirm card -> optional reason (textarea, max 300 chars) -> `POST /v1/customer/orders/{orderNo}/cancel` body `OrderCancelRequestDto` {reason?}. Success -> router.refresh(). Response `OrderDetailDto` (not used directly).
    - Error codes mapped in strings: ORDER_ON_HOLD, ORDER_NOT_CANCELLABLE, SHIPMENT_BOOKED, LOGIN_REQUIRED, ORDER_NOT_FOUND, TOO_MANY_REQUESTS (429), network, generic.
  - Invoice link (if status in `shipped | partially_shipped | delivered | completed`) -> `/order/{orderNo}/invoice`.
  - Request return (if status in `delivered | completed` AND (no item reports returnableQty, OR some item has returnableQty > 0)) -> `/account/returns/new?order={orderNo}`.
  - Back link -> `/account/orders`.
- States: not found (404) / load error; notes per status; empty shipments section hidden; cancel error notice.
- Notes: no courier event history (only shipment status, handedAt, deliveredAt, trackingUrl). No per-unit cancel. No reorder. No item photos beyond `image`. Cancel reason is sent but never shown back.

### /account/addresses
- Files: `app/[lang]/account/addresses/page.tsx`; `features/orders/AddressesManager.tsx`; `features/checkout/{AddressFields.tsx,address.ts,geo.ts,SelectField.tsx}`; `features/account/Field.tsx` (Notice).
- Rendering: server (initial list); manager is client.
- Auth: required.
- Data loaded:
  - Server: `GET /v1/customer/addresses` (no query) -> `AddressListDto` (array).
  - Client, after every change: `GET /v1/customer/addresses` (re-read).
  - Geo (client, cached per page load, shared with checkout): `GET /v1/public/geo/divisions`; `GET /v1/public/geo/districts` (query {}); `GET /v1/public/geo/upazilas?districtId=N`.
    - Division: `id`, `nameEn`, `nameBn`. District: + `divisionId`. Upazila: + `districtId`.
- Fields shown (AddressDto, per card): `label` (string|null; prefix "label · "), `name`, `isDefault` (Default badge), `phone`, `line`, `placeText` (or `placeTextBn` when lang = bn), `landmark`.
  - Not rendered: `id` (used for keys/actions), `districtId`, `upazilaId`, `areaId` (see Notes), `placeTextBn` in EN.
- Form fields: name*, phone*, division* / district* / upazila* (cascading selects by id), line* (min 3 chars), landmark, label, "make default" checkbox (create only).
  - Client validation: name required; phone must normalize to 01XXXXXXXXX (`normalizePhone`); division/district/upazila required; line >= 3 chars.
- Limit: max 10 addresses (add button disabled at 10, limit text shown).
- Actions:
  - Add: `POST /v1/customer/addresses` body `CreateAddressDto` {name, phone (trimmed, as typed), districtId, upazilaId, line, landmark (string|null), label (string|null), isDefault}.
  - Edit: `PATCH /v1/customer/addresses/{id}` body `UpdateAddressDto` {name, phone, districtId, upazilaId, line, landmark, label}. isDefault NOT sent here.
  - Set default: `PUT /v1/customer/addresses/{id}/default` (no body).
  - Delete: inline confirm -> `DELETE /v1/customer/addresses/{id}`.
  - After add/edit/default/delete: list re-read; mode back to list.
- States: empty list text (addrEmpty); limit text; busy disables buttons; error notice from API (fail()); geo load failure shows as error (geo.ts drops cache on failure, retry possible).
- Notes:
  - `areaId` exists in API DTOs but this UI never sends or shows it.
  - Phone is sent trimmed, not normalized client-side (API normalization: UNSURE).
  - No map, no GPS, no delivery-zone preview on this page.

### /account/returns
- Files: `app/[lang]/account/returns/page.tsx`; `features/returns/{ReturnList,types,logic}.ts(x)`; `returns.module.css`.
- Rendering: server. Auth required.
- Data loaded:
  - `GET /v1/customer/returns` (server) query: `page` (from `?page=`). `limit` not sent.
- Fields shown (ReturnCustomerListDto `items[]`):
  - `returnNo`, `orderNo` ("for order"), `requestedAt`, `status` (badge), item count = sum of `items[].qty`.
  - `total`, `page`, `limit` -> pager.
  - Not rendered: `fault`, `returnShippingP`, `rejectReason`, `items[]` details, `mediaIds`, `refunds`.
- Actions: row -> `/account/returns/{returnNo}`; prev/next.
- Status labels: requested "Request received" | approved "Approved" | rejected "Rejected" | pickup_booked "Pickup arranged" | received "Received by us" | inspected "Checked" | closed "Completed".
- States: empty -> EmptyState listEmpty + CTA `/account/orders`; error -> loadError.
- Notes: no cancel-return action. No photos.

### /account/returns/new?order=<orderNo>
- Files: `app/[lang]/account/returns/new/page.tsx`; `features/returns/{ReturnForm,logic,types}.ts(x)`.
- Rendering: server page; form is client.
- Auth: required.
- Data loaded:
  - `GET /v1/customer/orders/{orderNo}` (server) only if `?order=` non-empty. Used fields: `orderNo`, `status`, `items[]` {orderItemId, returnableQty, title, optionsText, image}.
- Eligibility branches (page):
  - No order / 404 / empty param -> "not found" (orders.notFound).
  - Not canRequestReturn -> nothingReturnable (if delivered/completed) else notDelivered.
  - Else -> form.
- Form (per line with orderItemId and returnableQty > 0): checkbox; qty (number, min 1, max returnableQty, clamped); reason select (`wrong_item | damaged | defective | not_as_described | change_of_mind | other`; default `defective`); note (max 500). Intro text.
  - Not sent: `mediaIds` (no upload in form).
- Actions:
  - Submit: `POST /v1/customer/returns` body `ReturnCustomerCreateDto` {orderNo, items: [{orderItemId, qty, reason, note?}]} (only checked lines with qty > 0). Success 200 `ReturnCustomerDto` -> router.push `/account/returns/{returnNo}` + refresh.
  - Client: no lines checked -> "pickOne".
- Error codes: ORDER_NOT_FOUND, ORDER_NOT_DELIVERED, RETURN_WINDOW_CLOSED, RETURN_QTY_EXCEEDED, RETURN_INVALID; NETWORK; HTTP 400 -> validation; else generic.
- States: not-found / not-delivered / nothing-returnable / submitting ("sending") / error notice.
- Notes: the form lists only lines with returnableQty > 0. Return-window and qty limits are enforced server-side; UI shows the API error only.

### /account/returns/[returnNo]
- Files: `app/[lang]/account/returns/[returnNo]/page.tsx`; `features/returns/{ReturnDetailView,logic,types}.ts(x)`; `returns.module.css`.
- Rendering: server. Auth required.
- Data loaded: `GET /v1/customer/returns/{returnNo}` (server, path param). 404 -> not found; else loadError.
- Fields shown (ReturnCustomerDto):
  - Header: `returnNo`, `orderNo` (link to order), `requestedAt`, `status` badge.
  - Progress: derived from `status` only (no per-step dates in API). Steps: requested > approved > pickup_booked > received > inspected > closed; rejected shows requested (done) + rejected (current). statusHint text per status.
  - `rejectReason` (shown only when status = rejected).
  - `fault` ('ours' -> "Our mistake", 'customer' -> "Customer reason"; null hidden).
  - `returnShippingP` (shown if > 0: "Return shipping fee").
  - Items `items[]`: `titleSnapshot`, `optionsText`, `qty`, `reason` (label), `note`.
    - Not rendered: `orderItemId` (key only), `sku`, `mediaIds`.
  - Refunds `refunds[]` (shown if non-empty): `amountP`, `method` (original -> "Original payment method" | wallet -> "Store wallet"), `status` (pending_approval "Waiting for approval" | approved "Approved" | rejected "Rejected" | processing "Processing" | done "Refunded" | failed "Failed, we will contact you"). `id` = key only.
- Actions: order link, back to `/account/returns`. No cancel/edit.
- Reason labels: wrong_item "Wrong item received", damaged "Arrived damaged", defective "Does not work", not_as_described "Not as described", change_of_mind "Changed my mind", other "Other".
- States: not found / load error.
- Notes: no timestamps per step; no inspection notes; no return photos; no tracking for return pickup (no return shipment fields in DTO).

### /account/coupons (coupon wallet)
- Files: `app/[lang]/account/coupons/page.tsx`; `features/promotions/{WalletList,logic,types}.ts(x)`; `strings.en.ts` (promos.wallet).
- Rendering: server page; WalletList client (state for removals).
- Auth: required.
- Data loaded: `GET /v1/customer/coupons` (server, no query, no pagination). Page reads `items`.
- Fields shown (CouponWalletListDto `items[]`):
  - `name`; value text by `type`: percent -> `value` is bp (value/100 %), with `maxDiscountP` ("up to ..."); fixed -> `value` paisa; free_delivery/bxgy/tiered/bundle -> fixed text.
  - `code` (string|null, shown as "Code: X"); `source` (collected -> "Collected" | assigned -> "Given to you" | bulk_code -> "Code").
  - Facts: `minOrderP` ("min order"), `startsAt` (shown only if in the future), `endsAt` ("valid until").
  - `termsEn` / `termsBn` (by page lang).
  - `state` badge: usable "Usable" | expired "Expired" | used_up "Used up" | not_started "Not started". Non-usable cards are dimmed.
  - `collected` (bool): controls Remove button.
  - Not rendered: `couponId` (key/action only), `kind` (only used by offers page), `type` drives text only.
- Actions:
  - Remove (only if collected = true): `DELETE /v1/customer/coupons/{couponId}`. On success removes locally (no refetch). Error -> notice.
  - Browse offers link (empty state) -> `/offers`.
- States: empty -> wallet.empty + emptyBody + "Browse offers" CTA; error -> loadError; remove error notice.
- Notes: no usage count, no remaining uses, no order link for redeemed coupons, no pagination. Codes are shown; applying happens in cart (not here).

### /account/affiliate
- Files: `app/[lang]/account/affiliate/page.tsx`; `features/affiliate/{AffiliateView,JoinCard,Dashboard,LinksTab,PayoutsTab,DetailsTab,CommissionTable,DayChart,LoadBox,useLoad,logic,types,strings.en.ts}`; `RefCapture.tsx` (global, see below).
- Rendering: server page (initial `GET /v1/customer/affiliate`), client tabs.
- Auth: required.
- Data loaded:
  - Server: `GET /v1/customer/affiliate` -> AffiliateMeDto.
  - Client (per tab, via useLoad):
    - `GET /v1/customer/affiliate/stats` query `days=30` (Dashboard).
    - `GET /v1/customer/affiliate/commissions` query `page`, `pageSize=20` (Dashboard + CommissionTable).
    - `GET /v1/customer/affiliate/payouts` query `page` (Payouts; `pageSize` not sent but pager assumes 20; API default: UNSURE).
- AffiliateMeDto fields: `joined` (bool, gate), `id`, `code`, `displayName`, `website` (string|null), `status` ('active'|'suspended'), `commissionBp` (int bp), `payoutMethod` ('bkash'|'bank'|null), `payoutDetailsMasked` (string|null), `clickWindowDays`, `minPayoutP`, `programEnabled` (bool).
- Gate:
  - joined = false -> JoinCard (shows programme rules from commissionBp, minPayoutP, clickWindowDays, programEnabled).
  - joined = true -> banner if `status` = suspended, or if `programEnabled` = false ("programme paused"). Tabs: Dashboard | Links & code | Payouts | Payout details.
- Dashboard (AffiliateStatsDto):
  - Tiles from `totals`: clicks, orders, conversion (`conversionBp` -> %), pendingP (hint), balanceP (hint), paidP. Not rendered: `totals.reversedCount`.
  - Chart (DayChart, SVG bars): `days[]` {date (YYYY-MM-DD), clicks, orders}.
  - Note line: `me.code`, `me.commissionBp` (as %), `me.clickWindowDays`.
  - Commissions table (AffiliateMyCommissionListDto, 20/page, pager from total): `placedAt`, `itemCount` (+ "more items"), `firstItemTitle` ('-' if null), `attribution` ('link' -> Link | 'code' -> Code), `baseP`, `amountP`, `status` ('pending' Pending | 'approved' Approved | 'paid' Paid | 'reversed' Voided), `availableAt` (pending -> "approves {date}"), `reverseReason` ('order_cancelled' | 'nothing_kept'; other values blank).
    - Not rendered: `id` (key), `commissionBp` per row, order number (not in DTO).
- Links tab (no API call): input = URL/path on this site (must be same origin); output = `{origin}{path}?ref={me.code}` (+ hash). Copy buttons: link, and code (`me.code`). Note: `me.clickWindowDays`.
- Payouts tab: note with `minPayoutP`. Table (AffiliateMyPayoutListDto): `period` (e.g. month), `amountP`, `method` ('bkash' bKash | 'bank' Bank | 'cash' Cash, else raw), `reference`, `paidAt`. Empty state; pager.
  - Not rendered: `id` (key).
- Payout details tab: shows `payoutMethod` + `payoutDetailsMasked` (API never returns full numbers). Form starts empty.
  - Method radio: bkash | bank.
  - bKash: `bkashNumber` (normalized 01XXXXXXXXX), `holderName`.
  - Bank: `bankName`, `branch`, `accountNo` (6-20 digits), `accountName`.
  - Save: `PUT /v1/customer/affiliate/payout-details` body `AffiliatePayoutDetailsDto` {method, bkashNumber, holderName} or {method:'bank', bankName, branch, accountNo, accountName}. 200 response `AffiliateMeDto` -> state updated.
- Join (JoinCard): `POST /v1/customer/affiliate/join` body `AffiliateJoinDto` {displayName (2-80), website? (http/https), code? (A-Z0-9, 4-16, uppercased)}. 200 `AffiliateMeDto`; 409 `AffiliateErrorDto`.
  - Error codes handled: AFFILIATE_PROGRAM_OFF (switches to "programme off" card), AFFILIATE_CODE_TAKEN and AFFILIATE_CODE_INVALID (code field error), AFFILIATE_ALREADY_JOINED, NETWORK, 400 validation, generic.
- No UI for profile edit: `PATCH /v1/customer/affiliate` (AffiliateUpdateDto: displayName, website) exists in schema but is not called by the shop.
- Ref capture (global, mounted in `app/[lang]/layout.tsx`): on any page with `?ref=CODE`: `POST /v1/public/affiliates/click` body `AffiliateClickDto` {code (max 32), landingUrl (path+search without ref, max 500), utm? {source, medium, campaign}}. Then strips `ref` from the URL. No UI, errors ignored.
- States: LoadBox loading / error (retry) per tab; empty states per table; suspended / programme-paused banners; join errors.
- Notes: last-click-wins is server-side (rules text only). No per-link stats (clicks per link). No referred-order links. Payout history has no status or order list.

### /order/[orderNo] (placed order / success page)
- Files: `app/[lang]/order/[orderNo]/page.tsx`; `features/checkout/{SuccessView,errors}.tsx|ts` (`rememberPlaced`, `recallPlaced`, `PlacedOrder`, storage key `bdc_placed`); `features/promotions/DiscountList.tsx`.
- Rendering: server page resolves optional customer data; SuccessView client.
- Auth: optional. Guest access: yes.
- Data loaded:
  - Logged in (customer cookie present): `GET /v1/customer/orders/{orderNo}` (server). Mapped to PlacedOrder: `money.grandTotalP`, `money.codDueP`, `zone.etaMinDays/etaMaxDays`, `zone.nameBn|nameEn` (zoneName), `discounts[]` (amount = amountP + deliveryP).
  - Guest: NO API call. Reads sessionStorage `bdc_placed` (JSON `PlacedOrder`, written by checkout after `POST /v1/checkout/place`), only if `orderNo` matches. Per-tab storage: other tab/browser -> unknown state.
- PlacedOrder fields: `orderNo`, `grandTotalP`, `codDueP`, `etaMinDays|null`, `etaMaxDays|null`, `zoneName|null`, `discounts?[]` {name, code, amountP, freeDelivery}. Note: `CheckoutPlacedDto.affiliate` is not part of PlacedOrder.
- Fields shown: order number, total (grandTotalP), COD due (codDueP), ETA text (both eta values present), discounts (DiscountList), next steps (3 static steps; step 3 includes codDueP), guest hint + signup link (guest only).
  - Not rendered: `zoneName`.
- Actions:
  - "Track" -> logged in: `/account/orders/{orderNo}`; guest: `/track?order={orderNo}`.
  - "Continue shopping" -> `/`.
  - Guest: signup link.
  - Unknown order state: "Track" -> `/track?order=...`; logged in also "My orders".
- States: pending check (aria-busy empty div) until client resolves; success; unknown (no server data and no sessionStorage match).
- Notes: a guest has no API read of this order at all. A new tab or browser loses the summary (same-tab refresh keeps it); /track works (phone needed).

### /order/[orderNo]/invoice
- Files: `app/[lang]/order/[orderNo]/invoice/page.tsx`; `features/returns/{InvoiceView,PrintButton,types,invoice.module.css}`.
- Rendering: server; PrintButton client.
- Auth: required (requireCustomer path `/order/{orderNo}/invoice`).
- Data loaded: `GET /v1/customer/orders/{orderNo}/invoice` (server, path). 409 or 404 -> "not available" state; other -> loadError.
- Fields shown (DocInvoiceDetailDto): `invoiceNo`, `issuedAt`, `orderNo`, `vatRateBp`/`snapshot.vat.rateBp` (VAT rate), `snapshot.vat.totalP`, `snapshot.vat.netP` (VAT note); `snapshot.lang`.
  - Store block: `store.name`, `store.address`, `store.phone`, `store.email`, `store.bin` (shown if set).
  - Bill-to: `billTo.name`, `billTo.phone` (if set), `billTo.email` (if set).
  - Ship-to: `shipTo.name`, `shipTo.phone`, `shipTo.address`, `shipTo.placeText`.
  - Lines `lines[]`: `titleSnapshot`, `sku`, `optionsText`, `qty`, `unitPriceP`, `lineTotalP`.
  - Totals: `subtotalP`, `autoDiscountP`, `couponDiscountP`, `deliveryChargeP`, `deliveryDiscountP`, `grandTotalP`, `paidP`, `codDueP`.
  - Labels exist for `orderDate`, `paymentMethod` and `bin`; exact rendering of `snapshot.orderDate`/`paymentMethod` UNSURE (not read in full).
  - Not rendered: `id`, `orderId`, `isCurrent`, `vatTotalP`/`grandTotalP` at top level (snapshot used), `bin` at top level.
- Actions: Print (window.print on click, not on load). Back -> `/account/orders/{orderNo}`.
- Availability: invoice exists once order status is shipped | partially_shipped | delivered | completed (UI gate, same rule as API).
- Notes: print view only; no PDF download endpoint in schema. Invoice is an immutable snapshot (`snapshot`).

### /track (guest order tracking)
- Files: `app/[lang]/track/page.tsx`; `features/orders/{TrackForm,Timeline,ShipmentCards,CancelOrder,types,format}.tsx|ts`; `features/account/lib.ts` (normalizePhone, call).
- Rendering: server page (reads `?order=`, max 20 chars, and login state via getCustomer); TrackForm client.
- Auth: none (guest). Logged-in state only toggles a login hint (shown when logged out).
- Data loaded:
  - On submit: `POST /v1/public/track` body `OrderTrackRequestDto` {orderNo (uppercased, digits normalized), phone (normalized 01XXXXXXXXX)}.
- Fields shown (OrderTrackDto):
  - `orderNo`, `status` (badge), `placedAt`, `maskedPhone` ("phone on file ..."), `itemCount`, `grandTotalP`.
  - ETA (only when status = processing): `etaMinDays`, `etaMaxDays`.
  - `timeline[]` {status, at} (oldest first; last = current).
  - `shipments[]`: same fields as order detail (shipmentNo, status, courier {code, name}, trackingId, trackingUrl, handedAt, deliveredAt, items[]).
  - `canCancel`.
  - Not in DTO: items, money breakdown, addresses, discounts.
- Actions:
  - Submit lookup (validation: orderNo >= 3 chars; phone must normalize).
  - "Track another" -> resets to form.
  - Cancel (only if canCancel): `POST /v1/public/track/cancel` body `OrderTrackCancelRequestDto` {orderNo, phone (the phone that matched), reason?} -> returns OrderTrackDto, replaces result, shows cancelDone notice if status = cancelled.
    - Same error code strings as the customer cancel (CancelOrder), plus TOO_MANY_REQUESTS for 429; other codes fall back to generic.
- States: form error; 404 -> trackNotFound; 429 -> trackTooManyIn (minutes from retryAfterSec) or trackTooMany; other -> trackError; result view.
- Notes: rate-limited lookups (429 + retryAfterSec). Phone is kept in memory only for the cancel step.

### /checkout (brief; designed elsewhere)
- Files: `app/[lang]/checkout/page.tsx`; `features/checkout/{CheckoutForm,OtpBlock,AddressFields,Summary,SelectField,address,geo,eta,errors,types}.tsx|ts`.
- Endpoints:
  - Server: `GET /v1/cart` (cookies bdc_cs + bdc_vid); `GET /v1/customer/addresses` (when logged in).
  - Geo (client): `GET /v1/public/geo/divisions`, `GET /v1/public/geo/districts`, `GET /v1/public/geo/upazilas?districtId`.
  - `POST /v1/checkout/quote` body `CheckoutQuoteRequestDto` {districtId, upazilaId, areaId?} -> `CheckoutQuoteDto`: zone{id, nameEn, nameBn, etaMinDays, etaMaxDays}, subtotalP, autoDiscountP, couponDiscountP, appliedCoupons[], rejectedCodes[{code, reason}], affiliate, deliveryChargeP, deliveryDiscountP, grandTotalP, freeDeliveryRemainingP, guestOtpRequired, problems[] (CART_EMPTY | CART_CHANGED | OUT_OF_STOCK).
  - `POST /v1/checkout/otp` body {phone} (guest OTP).
  - `POST /v1/checkout/place` body `CheckoutPlaceDto` {addressId | address{name, phone, districtId, upazilaId, areaId?, line, landmark?}, guest{name, phone, email?}, otpCode?, note?, lang, idempotencyKey} -> `CheckoutPlacedDto` {orderNo, orderId, grandTotalP, codDueP, affiliate{code, displayName}|null}. Then rememberPlaced(sessionStorage) and navigation to /order/{orderNo}.
  - `POST /v1/customer/addresses` (inline save of new address, logged in).

### /cart (brief)
- Files: `app/[lang]/cart/page.tsx`; `features/cart/{CartView,server,store,QtyStepper,CartCount,types}.ts(x)`; `features/promotions/CartCoupons.tsx`.
- Server: `GET /v1/cart` (cookies bdc_cs + bdc_vid; no cookie -> empty cart without call).
- Client store:
  - `GET /v1/cart`
  - `PUT /v1/cart/items/{variantId}` body `CartSetQtyDto` {qty}
  - `DELETE /v1/cart/items/{variantId}`
  - `POST /v1/cart/coupon` body `CartCouponCodeDto` {code}
  - `DELETE /v1/cart/coupon/{code}`
  - `DELETE /v1/cart/affiliate-code`
  - `GET /v1/cart/coupon-suggestions` -> items[] {couponId, name, code, savingP, source 'wallet'|'public'}
- CartDto: items[] (variantId, productId, slug, titleEn/titleBn, optionsTextEn/Bn, image, qty, unitPriceP, compareAtP, priceAtAddP, priceChanged, available, maxQty, problem (out_of_stock|qty_reduced|unavailable|upcoming|null), flashEndsAt, discountP), count, subtotalP, discountP, appliedCoupons[], codes[], rejectedCodes[{code, reason}], affiliate {code, displayName}|null.

---

### Not available from the API (checked against DTOs and calls above)
- Order item images: AVAILABLE (`items[].image`, `firstImage` in list).
- Delivery map / coordinates: NOT available (no lat/lng in address or zone DTOs).
- Live courier events / scan history: NOT available (shipments give status, courier, trackingId, trackingUrl, handedAt, deliveredAt only).
- Courier per-event timestamps for returns / return pickup details: NOT available (no return shipment fields).
- Return photos / media: `mediaIds: string[]` exists on ReturnCustomerDto and ReturnCustomerCreateDto, but no customer upload endpoint exists in schema and the shop does not render or send it.
- Return item images: NOT available (ReturnCustomerDto items have titleSnapshot, sku, optionsText only).
- Return per-step dates / inspection notes: NOT available (status only).
- Return shipping label/tracking: NOT available.
- Refund per-line breakdown: NOT available (refunds[] = amountP, method, status, id).
- Affiliate payout history: status, order list, and fees NOT available (AffiliateMyPayoutListDto: id, period, amountP, method, reference, paidAt).
- Affiliate commission -> order number link: NOT available (only placedAt, itemCount, firstItemTitle, attribution, baseP, amountP, status, availableAt, reverseReason).
- Affiliate per-link click stats / landing pages: NOT available (stats are daily totals only; `days` param).
- Affiliate payout method full details: NOT returned (masked only).
- Coupon usage: NOT available (no uses count, no redeemed-on order link, no remaining uses).
- Order status filter / search / date range on order and return lists: NOT available (page and limit only).
- Order reorder: NOT available (no endpoint).
- Customer-side return cancel: NOT available (no endpoint).
- Customer-side address area (`areaId`) selection in UI: DTO has it, UI never sends it.
- Customer phone change: NOT available (UpdateCustomerDto has no phone).
- Guest order detail by order number (without phone): NOT available (only /v1/public/track with phone; guests get the success summary from sessionStorage only).
- Invoice PDF download: NOT available (print view only from JSON snapshot).
- Zone name on order detail page: available (`zone.nameEn/nameBn`) but not rendered there (rendered only on success page as zoneName).
- Order `lang` and `isPreorder`: available in OrderDetailDto but not rendered.

### UNSURE items
1. `/account/affiliate` PayoutsTab: request sends no `pageSize`, pager divides by PAGE_SIZE=20; API default page size for `/v1/customer/affiliate/payouts` not verified.
2. `/account/orders` and `/account/returns` lists: API default `limit` not verified (UI sends only `page`).
3. `/order/[orderNo]/invoice`: exact rendering of `snapshot.orderDate` and `snapshot.paymentMethod` not verified line by line (labels exist).
4. `/account/addresses`: whether the API normalizes `phone` on POST/PATCH (UI sends trimmed raw input).
5. `/track` cancel: full error-code list of `POST /v1/public/track/cancel` (UI maps the same strings as customer cancel; API codes not enumerated in schema read).
6. `/account` dashboard: PasswordForm/ProfileForm success-state exact copy not read (not needed for redesign data contract).

# 02 — Storefront (Web + Android)

## Design principles [USER]

- Home page must look stunning and attract attention.
- Compact, but text readable and tap targets comfortable (min 44–48px touch targets, 14px+ body text on mobile).
- Android/mobile: **no unused gaps** — use all space, but enough breathing room to not look cluttered.
- Lightweight framework for web and mobile; mobile optimized for speed and efficiency.
- [DECIDED] Light + dark mode (toggle + follow system) (Q9). EN/BN toggle (Q8).
- [DECIDED] No brand identity yet — mockups will propose logo direction, colors, fonts (Q38). Fonts must support Bangla well.

## Web layout (desktop) [DECIDED]

```
┌──────────────────────────────────────────────────────────────────┐
│ ☎ Hotline · Track order                        EN/বাং · ☀/🌙      │ ← top utility bar (Q10)
├──────────────────────────────────────────────────────────────────┤
│ [Logo]  [ Search ............................ 🔍 ]  ♡  👤  🛒(3) │ ← sticky header
├──────────┬───────────────────────────────────────────────────────┤
│Electro  ▸│                                                       │
│Fashion  ▸│          CAROUSEL (dynamic # of slides)               │
│Home     ▸│                                                       │
│Beauty   ▸│                                                       │
├──────────┴───────────────────────────────────────────────────────┤
│ [img][img][img][img][img][img][img][img]  ← featured main cats  │
│ ELEC  FASH HOME BEAU GROC SPRT SOLR BOOK     (label on chip)    │
├──────────────────────────────────────────────────────────────────┤
│ Infinite weighted-random product grid                            │
│  … every N products: flash sale / recently viewed / event row … │
└──────────────────────────────────────────────────────────────────┘
```

- Sticky header: logo, search, wishlist ♡, profile (or Login), cart with count. [USER + Q10]
- Top utility bar (not sticky): hotline, track order, language toggle, dark mode toggle. (Q10) Language/dark toggles may move into the main header in mockups; decide visually.
- Side category menu beside the carousel shows the full tree (fly-out on hover, up to 4 levels).

## Android / mobile layout [DECIDED]

```
┌───────────────────────────┐
│ [Logo] [ Search ...... 🔍]│ ← sticky search
├───────────────────────────┤
│  Carousel (mobile images) │
│ [▢][▢][▢][▢][▢]→          │ ← 2-row horizontal category tiles
│ [▢][▢][▢][▢][▢]→          │
│ ┌────┐┌────┐              │
│ │prod││prod│  2-col grid  │ ← edge-to-edge, 4–8px gutters
│ └────┘└────┘              │
├───────────────────────────┤
│ 🏠  ☰Cat  🔥Offers 🛒  👤 │ ← bottom nav (Q11)
└───────────────────────────┘
```

- Bottom nav: Home / Categories / Offers / Cart / Account. (Q11)
- Mobile web uses the same layout as the Android app (and is installable as a PWA until the app ships — S12).

## Carousel [USER]

- Number of slides is dynamic (admin adds/removes).
- Per slide: desktop image, mobile image, link target (product, category, event, URL), start/end date, sort order, active toggle.
- Auto-rotate, pause on touch; first slide loads eagerly, rest lazy.
- Only one carousel; the home page has no other admin-built sections (Q13).

## Category section [DECIDED]

- Desktop: side menu beside carousel (full tree) + image tile grid below for the main categories chosen by super admin.
- Mobile/Android: 2-row horizontal-scrolling image tiles.
- Label: bold text on a solid colored chip below the image (Q15).
- Main categories must have an image; sub-categories optional with fallback icon (Q20).

## Product card [DECIDED] (Q12)

- Image, **1-line** title (ellipsis), price, old price struck through + discount % badge, ★ rating + count, sold count, badges (Free delivery / Flash sale / New / Pre-order / Out of stock).
- No add-to-cart button on the card; tap opens the product page.

## Home product feed [USER + DECIDED]

- Infinite scroll on web and Android.
- **Weighted random** (Q16): new, discounted, high-rated and admin-pinned products get a higher chance; out-of-stock products still appear with a label but ranked low (Q17). Weights adjustable by admin sliders (Q83).
- Random order fixed for one page load (no duplicates while scrolling), new order on every refresh.
- Special rows every N products: flash sale, recently viewed, event banner (Q18).

## Other storefront pages

- Category page: breadcrumb, sub-category chips, filters (price, brand, rating, in-stock, category attributes — Q25), sort.
- Search results with same filters; autocomplete (English only at launch, Q30).
- Product page: gallery + YouTube video (Q26), price/discount, up to 2 variant options (Q24), quantity, Add to cart, Buy now, pre-order info (Q27), stock, sanitized HTML description, specs table (attributes), reviews with photos + staff replies (Q35), Q&A (Q36), similar / also-bought products (S4), trust badges (S10), share buttons (S11). Delivery ETA by location — later (S9).
- Cart, Checkout (doc 05), Order success.
- Account: profile, orders + tracking, addresses, wishlist, reviews, coupon wallet (Q44), store wallet (refunds/cashback), loyalty points (S15), referral link (S14), notification inbox (Q37), support tickets (Q84). Separate affiliate dashboard for affiliates (Q78).
- Guest order tracking by order no. + phone (S6). Tracking shows our statuses until hand-off to courier, then courier name + tracking ID/link.
- Offers tab/page: active event (only one at a time, Q48), flash sales, collectable coupons.
- Event pages (doc 04), static pages (About, Policies, Contact, FAQ) from admin CMS.
- Privacy policy + one-time cookie notice (Q40). Maintenance mode + announcement bar (S35).
- Empty/loading/error states for every page (checklist in doc 09).

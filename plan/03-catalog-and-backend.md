# 03 — Catalog & Backend Features

## Dynamic categories [USER + DECIDED]

- Categories live in the DB; nothing hard-coded.
- **Max 4 levels total** (main + 3 sub levels) (Q19).
- Super admin chooses which **main** categories show on the home page.
- Main categories require an image; sub-categories optional (Q20).
- A product can be in **multiple categories** (Q21), attached at **any level** (Q22). Category pages show products from the category and all its descendants.
- Category attributes (e.g. RAM, Fabric) defined per category, inherited by sub-categories, used as filters (Q25).

```
Electronics                          (level 1)
├── Phones / Smartphones             (level 2)
├── Appliances                       (level 2)
│   ├── Home Appliances              (level 3)
│   └── Kitchen Appliances           (level 3)
│       └── Rice Cookers             (level 4 — max)
└── Solar Power
    ├── Panels
    └── Inverters
```

Category fields: name (EN + BN), slug, parent, image, icon, banner image, description, sort order, active, show-on-home, attributes, SEO title/description.

**Delete flow (Q23):** admin always gets a dialog:
1. Move products + sub-categories to another category , or
2. Delete category + sub-categories + all their products. Products with order history are archived, others hard-deleted (Q70).

Move option sends everything to **one** target category (Q73).

## Products

- Title (EN + BN), slug, SKU, brand, categories (many), tags.
- Price, compare-at price, cost price (admin-only).
- Variants: up to **2 option types** (e.g. Color × Size); each combination has its own SKU, price, stock, images (Q24).
- Attributes/specs from category attribute sets (Q25).
- Images (multiple, auto-resized WebP/AVIF via CDN — S31), YouTube video link (Q26).
- Weight/dimensions (delivery charge — Q50), per-product delivery charge override, warranty info, return window override (Q59).
- Source: own stock or dropship supplier (Q3, Q62). Dropship supplier ships direct or via our warehouse — per-supplier setting (Q82).
- Status: draft / published / archived; scheduled publish.
- Stock tracking, low-stock threshold. **Pre-order** with expected date; always partial advance (admin-set %), rest on delivery (Q27, Q80).
- SEO fields, structured data (S32); related / similar / also-bought (manual + automatic, S4).
- Admin-pinned flag for home feed weighting (Q16).
- Bulk import/export via Excel/CSV (S24).
- Leave room for a future `seller` on products (Q2).

### HTML descriptions [USER + DECIDED]

- Allowed (Q28): headings, paragraphs, lists, bold/italic/underline, links, tables, images, **YouTube iframes only**, inline styles.
- Always stripped: `<script>`, `<style>` blocks, `on*=` attributes, `javascript:`/`data:` URLs, non-YouTube iframes, forms, objects/embeds. Inline `style` values filtered (no `url()`, `expression`, `position:fixed`).
- Sanitize on save **and** on render.
- Editor: WYSIWYG with "view HTML" switch (Q29).
- Android app renders the same sanitized HTML with JS disabled.

## Search

- Search bar in sticky header (web) and top of app.
- English only at launch (Q30); Bangla/Banglish later.
- Autocomplete (products, categories, brands), typo tolerance.
- Log every search term + zero-result searches for admin analytics.

## Random home feed [DECIDED]

- Weighted random (Q16), out-of-stock ranked low (Q17). Weights set with admin sliders (Q83).
- Random seed per page load → stable order while scrolling, new order on refresh.

## Visitor tracking [USER + DECIDED]

- Long-lived first-party cookie (anonymous visitor ID) on web; install ID on Android.
- Visit = return after 30 min inactivity. Count visits per visitor.
- Record: page/product views, searches, add-to-cart, checkout start, traffic source (UTM, FB, TikTok, Google, direct), device/browser, approximate district from IP.
- Link anonymous history to customer on login/order.
- Also: Facebook Pixel + Conversions API, Google Analytics, TikTok Pixel (Q31).
- Raw data kept forever (Q32) — fine at year-1 scale; partition by month so old data can be moved to cheap storage later.
- Feeds: recently viewed (S3), recommendations (S4), funnel analytics, abandoned cart emails (S16), velocity fraud rules (Q54).

## Customers / accounts [DECIDED]

- Login: phone + password, email + password, Google, Facebook (Q33).
- SMS OTP to verify phone at signup and for password reset (Q33b). SMS provider chosen later, swappable (Q75).
- Guest checkout allowed (Q34); guest COD above admin-set ৳X needs SMS OTP (Q81); guest orders linked to an account if the phone later registers.
- Profile: name, phones, email, addresses (Division → District → Upazila/Thana → Area), store wallet (spend only, Q79), loyalty points, referral code.

## Reviews & Q&A [DECIDED]

- Reviews: verified buyers only (after delivery), photos allowed, published immediately, staff can hide and reply publicly (Q35).
- Product Q&A: customers ask, staff answer, public (Q36).

## Notifications [DECIDED]

- v1 channels: SMS, email, in-app inbox, web push; Android push when app ships (Q37).
- Triggers: OTP, order placed/processing/handed to courier/delivered, refund, event start, abandoned cart (**email only**, S16), push campaigns (S19). Back-in-stock / price-drop alerts later (S5).
- Admin-editable templates in EN/BN.

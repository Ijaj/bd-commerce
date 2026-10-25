# 01 — Scope, Goals, Constraints

## Goals [USER]

- General-purpose store for Bangladesh: any product type, any category.
- Visually stunning home page, but compact, readable, easy to tap.
- Lightweight and fast on web and especially on Android (low-end phones, slow/expensive mobile data).
- Fully data-driven: categories, home sections, carousel, events all come from the DB and are managed in admin.
- Full-featured admin with dynamic roles and a clear permission matrix.

## Business model [DECIDED]

- **Single vendor now, marketplace later** (Q2). Data model must leave room for sellers (e.g. every product/order line can later carry a seller ID) without building seller features now.
- **Mixed inventory** (Q3): one own warehouse (Q60) + dropshipped items from suppliers (full supplier module, Q62). Dropship flow details: Q82.
- **B2C only** (Q4).
- **Scale year 1: small** (<5k products, <100 orders/day, <5k visitors/day) (Q7). Keep infra simple.
- **Team:** owner + Claude, no deadline, quality first (Q6).
- **Languages:** EN + BN toggle, price `৳1,25,000` (Q8). Search English-only at launch (Q30).
- **Order of delivery:** web storefront + admin + backend → Android (PWA in between) → iOS (Q5).

## Bangladesh context to design for

- **Cash on Delivery (COD)** is the dominant payment method. Fake/unreceived COD orders are a real cost → need order confirmation + fraud signals.
- **Mobile wallets:** bKash, Nagad, Rocket, Upay. Cards via aggregators (SSLCommerz, aamarPay, ShurjoPay, etc.).
- **Couriers:** Pathao, Steadfast, RedX, Paperfly, eCourier, Sundarban, etc. Most have APIs for booking + tracking.
- **Delivery pricing** usually split "Inside Dhaka / Outside Dhaka" (sometimes "Dhaka suburbs").
- **Address hierarchy:** Division → District → Upazila/Thana → Area/Union → street/house. Phone number is the primary identity.
- **Phone-first users:** most traffic is mobile, much of it from Facebook/TikTok ads.
- **Language:** Bangla and English. Price formatting `৳1,25,000` (lakh grouping) vs `৳125,000` (Q8).
- **Seasonal peaks:** Eid-ul-Fitr, Eid-ul-Adha, Pohela Boishakh, 11.11, Black Friday, Durga Puja, winter, back-to-school.
- **Regulation (verify with a lawyer before launch):**
  - Digital Commerce Operation Guidelines (2021, amended): delivery time limits, refund deadlines, rules on taking advance payment (escrow), seller info disclosure.
  - Digital Business ID (DBID) registration, trade license, VAT/BIN for invoices.
  - Personal data protection law status (a data protection ordinance was in progress in 2025; confirm what applies today). Visitor tracking cookies are fine to plan, [DECIDED] privacy policy page + one-time dismissible cookie notice (Q40).

## Non-goals (for now) [SUGGESTED]

- iOS app (later).
- International shipping / multi-currency.
- Native desktop apps.

# 07 — Suggested Features (need your yes / no / later)

[DECIDED] (details + notes in [10-decisions-log.md](10-decisions-log.md))

- **v1:** S1, S2, S3, S4, S6, S10, S11, S12, S13, S14, S15, S16 (email only), S17, S18, S19, S20, S22 (optional call), S23, S24, S25, S26, S28, S29, S31, S32, S33, S34, S35, S36 (with Android app)
- **Later:** S5, S7, S8, S9, S21 (velocity rules only in v1), S30
- **No:** S27

## Storefront / customer
| ID | Feature | Why |
|---|---|---|
| S1 | Bangla + English language toggle | Wider reach outside Dhaka |
| S2 | Wishlist | Standard, cheap to build |
| S3 | Recently viewed (uses visitor cookie) | Brings people back to products |
| S4 | "Customers also bought" / similar products | Higher order value |
| S5 | Back-in-stock & price-drop alerts | Reuses notification system |
| S6 | Order tracking without login (order no. + phone) | Many BD customers order as guest |
| S7 | Live chat / "Order via WhatsApp/Messenger" button | Very common BD buying habit |
| S8 | Product compare (mainly electronics) | Useful for phones/appliances |
| S9 | Delivery charge & ETA shown on product page by location | Reduces checkout drop-off |
| S10 | Trust badges (COD available, original product, easy return) | Trust is a big BD barrier |
| S11 | Social share buttons + Open Graph previews | FB-driven traffic |
| S12 | Progressive Web App (installable mobile web, offline shell) | Cheap "app" before Android is ready |

## Promotions / marketing
| ID | Feature | Why |
|---|---|---|
| S13 | Flash sales with countdown | Core BD sales driver |
| S14 | Referral program | Cheap acquisition |
| S15 | Loyalty points / cashback wallet | Retention |
| S16 | Abandoned cart SMS/push | Recovers lost sales |
| S17 | Facebook Pixel + Conversions API, Google Analytics | Ad optimization |
| S18 | Product feed for Facebook/Google catalog ads | Dynamic retargeting ads |
| S19 | Push notification campaigns (Android) | Free re-engagement channel |
| S20 | Affiliate / influencer codes with commission tracking | Common in BD |

## Operations
| ID | Feature | Why |
|---|---|---|
| S21 | COD fraud check (courier history lookup, blacklist) | Cuts failed deliveries |
| S22 | Order confirmation queue for call center | BD standard for COD |
| S23 | Courier API integration (auto booking + tracking) | Saves manual work |
| S24 | Bulk product import/export (Excel/CSV) | "Sell everything" = huge catalog |
| S25 | Audit log | Accountability with many staff |
| S26 | Invoice with VAT/BIN, printable labels | Legal + warehouse |
| S27 | Multi-warehouse stock | Only if you have >1 location |
| S28 | Supplier / purchase order module | Only if you hold inventory |
| S29 | Customer support tickets | Track complaints |
| S30 | Daily sales/stock report via email/SMS to owner | Owner visibility |

## Tech / quality
| ID | Feature | Why |
|---|---|---|
| S31 | Image auto-resize + WebP/AVIF + CDN | Speed on slow mobile data |
| S32 | SEO: sitemap, structured data, clean URLs | Free Google traffic |
| S33 | Backups + staging environment | Safety |
| S34 | Error monitoring + uptime alerts | Know about problems first |
| S35 | Maintenance mode / announcement bar | Ops control |
| S36 | Android app: in-app update prompt, deep links from SMS/FB ads | Engagement + campaign links |

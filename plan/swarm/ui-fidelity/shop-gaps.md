# Shop (apps/shop) UI-fidelity gap list (C60, SHOP-AUDIT, static)

Method: mockup markup (`plan/mockups/shared/{core,page-*,listing}.js`) and CSS (`base.css`, `pages.css`, `brand-d.css`) compared with `apps/shop` TSX and CSS modules, element by element. No servers, no screenshots. Items marked **needs browser check** cannot be judged from code alone. Nothing was edited except this file and the board.

Rules applied: only existing UI is restyled. Mockup parts whose feature or data does not exist in the shop are in section 4. Size tags: S = a few CSS lines, M = one component's CSS or small markup change, L = new layout or several components.

Conventions: `app:` paths are under `apps/shop/src/`. Mockup breakpoints are container queries on `#frame` (mobile <= 640px, tablet 641-1023px, desktop >= 1024px). The app uses viewport media queries with the same numbers in most places; where the app uses another number it is listed as a gap. "mock" = mockup, "app" = shop code.

Overall verdict: the shop is already a close port of brand D (tokens, header, footer, bottom nav, product card, price, search, filters all follow the mockup). The visible gaps are mostly (a) section headings without the D left bar, (b) the flash/gradient treatments (missing gradient tokens), (c) card shadows and form control sizes, (d) cart, checkout, track, success, login and account pages being plainer than their mockups, (e) smaller spacing and size differences.

---

## 1. Tokens and fonts

Source: `plan/mockups/shared/brand-d.css` on top of `base.css` defaults, versus `app: styles/tokens.css` (+ `styles/base.css`).

### 1.1 Light (`:root`)

Identical (name and value): `--s1..s7`, `--maxw 1360px`, `--gap 8px`, `--hd-pad 9px`, `--sec-gap 22px`, `--r-sm 3px`, `--r 4px`, `--r-lg 6px`, `--badge-r 3px`, `--search-r 4px`, `--sh-1`, `--sh-2`, `--lift -2px`, `--card-bd`, `--focus #1d4ed8`, `--focus-hdr #5eead4`, `--star #d97706`, `--scrim rgba(255,255,255,.82)`, `--primary #4338ca`, `--on-primary`, `--accent #0f766e`, `--on-accent`, `--hl #5eead4`, `--on-hl #1e1b4b`, `--bg #f4f4fb`, `--surface #fff`, `--surface-2 #ecebf8`, `--text #1e1b3a`, `--muted #5d5b7c`, `--border #dcdbef`, `--success #15803d`, `--on-success`, `--danger #be123c`, `--sale #be123c`, `--on-sale`, `--hdr-bg`, `--hdr-fg`, `--util-bg #1e1b3a`, `--util-fg #e0dfff`, `--search-bg`, `--search-btn-bg #0f766e`, `--search-btn-fg`, `--lm-bg`, `--lm-fg`, `--cnt-ring #3a34b8`, `--foot-bg #1e1b3a`, `--foot-fg`, `--foot-muted #c4c2e4`.

| # | Token | Mockup value | App value | Size |
|---|---|---|---|---|
| T1 | `--sl1` | `linear-gradient(115deg,#312e81 0%,#4338ca 60%,#6366f1 100%)` | missing | S |
| T2 | `--sl2` | `linear-gradient(115deg,#115e59 0%,#0f766e 60%,#14958a 100%)` | missing | S |
| T3 | `--sl3` | `linear-gradient(115deg,#4c1d95 0%,#6d28d9 60%,#8b5cf6 100%)` | missing | S |
| T4 | `--ev0` | `linear-gradient(110deg,#312e81,#6d28d9 60%,#a21caf)` | missing | S |
| T5 | `--ev1` | `linear-gradient(110deg,#115e59,#0f766e 55%,#0d9488)` | missing | S |
| T6 | `--flash-bg` | `linear-gradient(120deg,#312e81,#5b21b6)` | missing | S |
| T7 | `--flash-fg` | `#fff` | missing | S |
| T8 | `--cd-bg` / `--cd-fg` | `#14122e` / `#5eead4` (countdown boxes) | missing | S |
| T9 | `--cnt-ring` | `#3a34b8` | same | - |
| T10 | `--prog-end` / `--prog-bg` | `#4338ca` / `#e3e2f6` (progress bar) | missing | S |
| T11 | `--focus-flash` | `#fff` | missing | S |
| T12 | `--chip-r`, `--chip-m` | `0px`, `0px` | missing (unused: app tile chip has no radius or margin anyway) | - |
| T13 | `--hdr-bd`, `--hdr-sh` | unset in D (`transparent`, `none`) | missing (same effect) | - |

App-only tokens (keep): `--ann-bg #0f766e`, `--ann-fg #fff` (announcement bar), `--ph-a #e4e2f7`, `--ph-b #d3d0ef` (image placeholder, replaces the mockup's `hsl(var(--h) var(--ph-s) var(--ph-l))`), `--font-stack`.

New tokens are only worth adding when the matching gap (flash band, gradient banners, countdown boxes, progress bar) is approved: T1-T8, T10, T11. Colors would be copied from `brand-d.css` into `tokens.css` only (no hex elsewhere).

### 1.2 Dark (`:root[data-theme="dark"]`)

Identical: `--primary #9a94ff`, `--on-primary #0f0e1d`, `--accent #2dd4bf`, `--on-accent #04201c`, `--bg #0e0d1c`, `--surface #171630`, `--surface-2 #201f3f`, `--text #ecebff`, `--muted #a5a3c6`, `--border #2e2c54`, `--success #4ade80`, `--on-success #04210f`, `--danger #fb7185`, `--sale #e11d48`, `--on-sale #fff`, `--hdr-bg` (`#1e1b4b -> #2b2a7a`), `--util-bg #0b0a18`, `--util-fg #bdbbe0`, `--search-bg #201f3f`, `--search-btn-bg #2dd4bf`, `--search-btn-fg #04201c`, `--cnt-ring #26256b`, `--foot-bg #07060f`, `--foot-muted #a5a3c6`, `--focus #8ab4ff`, `--star #fbbf24`, `--scrim rgba(12,12,16,.66)`, `--sh-1`, `--sh-2`. `--hl`, `--on-hl`, `--lm-*` correctly inherit the light value in both.

| # | Token | Mockup dark value | App dark value | Size |
|---|---|---|---|---|
| T14 | `--flash-bg` | `linear-gradient(120deg,#1e1b4b,#3b1d7a)` | missing | S |
| T15 | `--cd-bg` | `#0b0a18` (`--cd-fg` stays `#5eead4`) | missing | S |
| T16 | `--prog-end` / `--prog-bg` | `#9a94ff` / `#2e2c54` | missing | S |
| T17 | `--sl1..3`, `--ev0/1` | not overridden in dark (same gradients) | missing (same as light gap) | - |

No contradicting color values were found in either theme. (`--ann-bg` dark `#115e59` is app-only.)

### 1.3 Fonts

| # | Item | Mockup | App | Size |
|---|---|---|---|---|
| F1 | Families | Poppins + Hind Siliguri via Google Fonts link | `next/font/google` Poppins + Hind_Siliguri, exposed as `--font-poppins`/`--font-hind` -> `--font-latin`/`--font-bn` (`app: app/[lang]/layout.tsx:17-28`) | OK |
| F2 | Poppins weights | 400,500,600,700,800 | 400, 700 only (`layout.tsx:19`) | S |
| F3 | Hind Siliguri weights | 400,500,600,700 | 400, 700 (`layout.tsx:25`) | OK (500/600 unused) |
| F4 | Wordmark weight | `.wm {font-weight:800; font-style:italic; text-transform:uppercase; letter-spacing:-.03em; font-size:24px}`, `.wm b {800}` (brand-d.css) | `font-weight:700` (`app: components/shell/Logo.module.css:19,27`); size 24px/20px mobile matches | S (add 800 to the Poppins weight list, set 800 in Logo.module.css). Note Q113 says bold only for h1/current crumb/logo, so 800 for the logo is consistent. |
| F5 | Body | 13.5px, line-height 1.45 (bn 1.6), antialiased | same (`styles/base.css:13-17`) | OK |
| F6 | `.pd-title` weight | the product title is the one h1 that is NOT bold (`h1:not(.pd-title){700}`), so 400 | app `h1{700}` (`base.css:73`) bolds it (see P3) | S |

Fonts are fine otherwise. Bengali glyphs come from Hind via the `--font-stack` fallback; no gap.

---

## 2. Global chrome

Mockup: `core.js` `headerHTML()` (line 787), `footerHTML()` (817), `dockHTML()` (831), `base.css` header/footer/dock sections + `brand-d.css`. App: `components/shell/*`, `features/browse/SearchBox*`, `features/account/HeaderLinks.tsx`, `features/cart/CartCount.tsx`.

### Matches (no action)
Util bar (`.topbar` 12.5px, min-height 36px, gap), header gradient/sticky/z-index 50, `--hd-pad`, logo mark 34px (30px mobile) and wordmark 24px/20px, search box (2px `--hl` border, radius `--search-r`, uppercase `.03em` button with 0 radius, focus outline), `.act` links (11.5px, column, hover mix 14%), cart/wishlist badge (`.cnt`, 18px, `--cnt-ring` ring), mobile two-row header, lang pill (`.seg`), theme toggle swap, bottom nav (5 items, 3px top indicator at 28%/28%, 11px labels, badge), announcement bar.

### Gaps

| # | Where | Mockup | App | Size |
|---|---|---|---|---|
| G1 | Mobile cart badge position: `app: components/shell/Header.module.css:90-105` (`.cnt` top -2px right 6px) used by `.cartM` too | `.cart-m .cnt {top:2px; right:0}` (base.css:342) so the badge sits on the 40px round button | mobile cart uses the desktop `.cnt` offsets (CartCount in `Header.tsx:58` gets no className) | S: pass a `className` with `top:2px; right:0` |
| G2 | Util bar links | `.tb-r` has Track order, **Sell on ShopName**, **Help**, language, theme | Track order, language, theme only (`UtilityBar.tsx:23-27`) | S, but both links have no target page -> NOT BUILT (section 4) |
| G3 | Search category dropdown (desktop) | `<select name="c">` before the input: `border:0; background:transparent; padding:0 12px; max-width:170px; border-right:1px solid var(--border)`; hidden <= 1023px | none (`SearchBox.tsx` has only the input) | M, or NOT BUILT if the search API has no category filter. `/v1/public/search` does take a category param (listing uses `c/[...slug]`), so it can be wired; **ASK lead** whether to add (it adds a field). Listed in section 4 as well. |
| G4 | Footer grid columns >= 1024px | `1.3fr .8fr .8fr 1.4fr` (base.css) | `1.6fr .8fr 1fr .8fr` (`components/shell/Footer.module.css:52`) | S |
| G5 | Footer newsletter band | `.foot-news`: h3 20px + input (white bg, `#1b1b1f` text, radius `--r`) + accent button, bottom border `rgba(255,255,255,.14)`, padding-block `--s6` | none | NOT BUILT (newsletter has no API) |
| G6 | Footer socials, courier note, app badges, extra links (Careers, Blog, How to order, Delivery, Returns, FAQ), payment chips Card/bKash/Nagad | present | only About/Contact, Track, hotline/email, COD chip | NOT BUILT (no pages/features). COD chip style matches (`.pay`: padding 5px 12px, radius `--r-sm`, border `rgba(255,255,255,.35)`, bg `rgba(255,255,255,.08)`, 12.5px). |
| G7 | Footer `h3` and links | `.foot h3 {14px; margin-bottom s3}`, links `3px 0` | same | OK |
| G8 | Footer focus ring | `.foot :focus-visible {outline-color:#fff}` (also `.event`, `.car`) | `.on-dark :focus-visible` uses `--focus-hdr` teal (`styles/base.css:82`) | S (teal on `#1e1b3a` is fine for contrast; low priority) |
| G9 | `.link` helper | `.link {display:inline-flex; align-items:center; gap:2px}` and "View all" carries a chevron icon (`icon('chevR',16)`) | `.link {color}` only (`styles/base.css:173`); "View all" is text only (e.g. `FeaturedCategories.tsx:20`, `HomeFlashStrip.tsx:31`, `CategoryMenu.tsx:44`) | S: add inline-flex/gap to `.link` and put `<Icon name="chevR" size={16}/>` after the label in the view-all links |
| G10 | Section heading `.sec-head h2` | D: `uppercase; font-weight:400; font-size:18px; letter-spacing:.01em; border-left:5px solid var(--primary); padding-left:10px`; mobile 17px (base.css 360ish: `.sec-head h2 {17px}`) | desktop rule exists (`styles/base.css:200-218`), **no 17px mobile rule**; home/flash/offers headings do not use `.sec-head` at all (see H1) | S for the mobile rule |
| G11 | Mobile spacing vars | `main {--sec-gap:20px; --gap:8px}` at <= 640px | `--sec-gap` stays 22px | S: add `@media (max-width:640px){ main{--sec-gap:20px} }` in `base.css` |
| G12 | Heart (wishlist) button on cards: `app: features/account/WishlistHeart.module.css:1-27` | final rule (pages.css:887): 32px (40px on gallery, 44-50px in CTA rows), `border-radius:50%`, no border, `background: color-mix(in srgb,var(--surface) 92%,transparent)`, `box-shadow:0 1px 4px rgba(0,0,0,.35)`, icon color `--text`, hover and pressed `--danger` with filled icon | 36px, `1px solid var(--border)`, `--surface`, `--sh-1`, color `--muted`, hover/on `--sale` | S: dark theme differs: `--danger` `#fb7185` vs `--sale` `#e11d48` |
| G13 | Cookie bar (dock) | `.cookie` bar above bottom nav | none | NOT BUILT (section 4) |
| G14 | Bottom-nav sticky action bar slot (`.sbar`) | pages can inject a sticky bar above `.bnav` (product add-to-cart, cart total) | none | NOT BUILT (section 4) |
| G15 | Empty state box `States.Box`: `app: components/States.module.css:1-18` | `.empty`: `padding:48px 16px; margin:16px 0; box-shadow:var(--sh-1)`; emoji/icon above (`.empty-i` 44px); `h2` 20px; `p` muted `margin-bottom:16px` | no shadow, no margin, h2 18px, no icon | S (shadow, margin, 20px); icon only if a glyph is acceptable (NOT BUILT otherwise) |
| G16 | Breadcrumb: `app: components/Breadcrumb.module.css` | `.crumbs ol {font-size:13px; margin:16px 0 12px}`, separator is the text "›" with 8px margins at 60% opacity, current item `font-weight:600`, links `padding:3px 0`; mobile: single line, horizontal scroll (`flex-wrap:nowrap; overflow-x:auto`) | `padding-block:12px; font-size:12.5px`, chevron icon 12px, current `700`, wraps on mobile | S |
| G17 | Page container | `.wrap.lst` etc.: `padding-bottom: --s5/--s6` only; top comes from crumbs margin | `.page {padding-block: s5 s6}` (`styles/base.css:219`) adds 24px above the breadcrumb | S |
| G18 | `.btn-lg`, `.btn-block` | `.btn-lg {padding:14px 22px; font-size:15px}`, `.btn-block {display:flex; width:100%}` (pages.css 337-338) | not defined | S: needed for checkout "Place order" and cart "Checkout" if M-sized tasks below are approved |
| G19 | Inputs (`.input`): `app: styles/base.css:186-197` | `.inp {min-height:44px; padding:10px 12px; border-radius:var(--r-sm)=3px; placeholder color --muted @ .85 opacity}`; focus `border-color:--primary`; error `--danger` | no min-height (about 42px), radius `--r` 4px | S |
| G20 | Cards generally lack `box-shadow: var(--sh-1)`. Mockup `.card-box`, `.sumbox`, `.cline`, `.pbox`, `.ocard`, `.acard` all carry it. App `.card/.summary/.panel/.line/.pbox/.addrCard/.orderRow` have none (`account.module.css:1-9 .card` does have it). | | | S each, listed per page below |

---

## 3. Pages

### 3.1 Home
Mockup: `home.html` -> `page-home.js` (+ `core.js` catMenu, `base.css` hero/carousel/tiles/bands). App: `app/[lang]/page.tsx`, `features/home/{Carousel,CategoryMenu,FeaturedCategories,Feed,FeedMore,SpecialRow,Hero}*`, `features/promotions/{HomeFlashStrip,Countdown}.tsx`, `promotions.module.css`.

Mapped as matching: h1 sr-only, hero grid (260px menu + carousel, `Hero.module.css:7-11`), category mega menu (rows 7px 16px, hover surface-2/primary, fly-out 3 cols, shadow, radius), carousel controls (40px round buttons, dots 24px hit area, pause button, 0.55s ease), tiles (4 cols, 6 at >=1024, mobile 2 rows x 100px horizontal scroll, scroll-snap), product feed grid (2/4/6 cols), "Show more" button + count, recent-viewed band, card hover (lift + `--primary` border).

| # | File:line | Mockup | App | Size |
|---|---|---|---|---|
| H1 | `features/home/FeaturedCategories.module.css:11-14` (`.head h2`), `Feed.module.css:5-9` (`.head h2`), `SpecialRow.module.css:5-9` (`.h`), `promotions.module.css:73-76` (`.sectionTitle`) + their TSX (`FeaturedCategories.tsx:20`, `Feed` section in `app/[lang]/page.tsx:87`, `SpecialRow.tsx:41`, `HomeFlashStrip.tsx:29-33`, `FlashSales.tsx:30`, `offers/page.tsx:40,47`) | `.sec-head h2, .band-h h2`: uppercase, 18px, weight 400, `letter-spacing:.01em`, `border-left:5px solid var(--primary)`, `padding-left:10px`; `.flash .band-h h2` bar is `--hl`; mobile 17px; `.sec-head` is `display:flex; justify-content:space-between; margin-bottom:16px` | 20px, no bar, no uppercase, `margin-bottom` varies. The product page already uses `<div className="sec-head">` correctly. Bn: text-transform none (already handled in `base.css`). | M (swap the four headers to the shared `.sec-head` markup/class; delete the local `h2` rules). Highest visible win on the home page. |
| H2 | `Feed.module.css:10-16` (`.more`) | `.more {margin-top:32px}`, `.more .btn {min-width:220px; padding-block:12px}` | `margin-top:24px`; button uses the default `.btn` padding | S |
| H3 | `SpecialRow.module.css:18-24` | `.hscroll > .card {flex:0 0 176px}`; recent band `.hscroll.rv > .card {136px}` + `card.xs` (hides meta and heart, price 14px, gap `0 5px`); mobile 140px / 112px | 150px / 128px mobile, normal card | S (width) / M (xs card variant: meta and heart hidden). Needs browser check for the recent band. |
| H4 | `promotions/HomeFlashStrip.tsx` + `promotions.module.css:101-117` | **Flash band** `.band.flash`: `padding:16px; border-radius:6px; background:var(--flash-bg); color:var(--flash-fg); box-shadow: inset 0 -3px 0 var(--hl)`; header row `.band-h` (bolt icon 22px + title, countdown, "View all" link right); heading bar color `--hl`; mobile `margin-inline:-12px; border-radius:0; padding:12px`; cards in `.hscroll` 176px with progress bar `.prog` (7px, gradient `--accent -> --prog-end`) + label | plain section: 6 cards, auto-fit grid, text countdown | L: needs T6-T8, T11, T14-T16; keep the Countdown logic, restyle with boxes (see H5) |
| H5 | `promotions/Countdown.tsx:70-78`, `promotions.module.css:1-8` | `.cd` with label then `.cd-b` boxes per unit: `padding:3px 7px; border-radius:var(--r-sm); background:var(--cd-bg); color:var(--cd-fg)`; digits `b` 15px tabular, unit `i` 11px | plain text "Ends in 02:03:04", 12px `--sale` | M (new markup of the same data; tabular `ch` width must stay) |
| H6 | Card flash tag `promotions.module.css:9-24` + `ProductCard` (`FlashTag`) | mockup card shows only the % badge and optional `.prog` bar | app shows a "Flash" badge + countdown line under the price | OK / keep (extra info the mockup lacks; style like `.off`) |
| H7 | `FeaturedCategories.module.css:29-66` (`.tile`, `.chip`) | tile `:hover` border `--primary` (D personality: `.card:hover, .tile:hover {border-color}`); chip `font-size:12px` uppercase `.02em`, bg colour from category hue | no border change on hover; chip bg is `style={{background}}` from `c.chipColor` (acceptable, data-driven) | S (hover border) |
| H8 | `Carousel.module.css:5-8,119-123` | `.car-track {min-height:380px}` desktop, 320px <= 1023px, 190px mobile (base.css) | `aspect-ratio` from the first slide image, min-height 300 / 220 / 0 | needs browser check (image-driven; likely fine) |
| H9 | `Carousel.module.css:43-44,51,70-71,100-109` hard-coded `rgba(255,255,255,.88)`, `#1b1b1f`, `#fff`, `rgba(0,0,0,...)` | same literals exist in `base.css` `.car-btn/.dot/.car-pp` | same values | OK (identical to mockup; rule "no hex outside tokens" only matters if the lead wants these tokenised; they are on-image overlays) |
| H10 | `CategoryMenu.module.css:55-73` | fly-out `width:600px` | `640px; max-width: calc(100vw - 340px); overflow-y:auto` | S, needs browser check |
| H11 | Hero spacing | `main > section.hero {margin-top:16px}`, mobile 0 | matches (`Hero.module.css`) | OK |
| H12 | Event / banner band between product groups (`.band.event.ev-0/1`: gradient banner with kicker, h2, text, CTA, emoji art) | present every 3rd band | `SpecialRow` renders nothing for `flash`/`event` kinds (`SpecialRow.tsx:57-58`) | NOT BUILT (section 4) |

Home gap count: S x6 (H2, H3a, H7, H10, plus G9/G10/G11 global), M x3 (H1, H3b, H5), L x1 (H4).

### 3.2 Category (`/c/[...slug]`) and all-categories (`/categories`)
Mockup: `category.html` -> `page-category.js` + `listing.js`, `pages.css` section 3. App: `app/[lang]/c/[...slug]/page.tsx`, `features/browse/{Listing.tsx,Listing.module.css,Page.module.css,FilterSheet,Pagination,SortSelect}`. `/categories` has no mockup (all-products uses `category.html` with no slug); its `.tree` cards are app-only and follow the card pattern (add shadow, G20).

| # | File:line | Mockup | App | Size |
|---|---|---|---|---|
| C1 | `app/[lang]/c/[...slug]/page.tsx:74-85`, `Page.module.css:1-19` | Always a gradient banner `.cat-banner.on-dark`: `background: var(--sl1..3)` (by main category), `min-height:150px` (170px >= 1024px, 110px mobile), `padding:32px 48px` (24px 16px mobile, full-bleed `margin-inline:-12px; border-radius:0`), `border-radius:6px`, `color:#fff`; **h1 inside** `.cat-t` 32px/1.15 (23px mobile); under it `.cb-s` "N results · free-delivery rule" opacity .96 with margin-top 8px | banner shown only when the category has an image; title is a separate h1 below it at 22px (`Page.module.css:1-4`); lead text below | M-L: put the h1 (and the existing result count) into the banner, use the image as the banner background when present, else `--sl1..3` (needs T1-T3). Keep the h1 as the same element (SEO) |
| C2 | `page.tsx:87-95`, `Page.module.css:20-47` | **Sub-category tiles** `.subcats`: circular `64px` image (`border:2px solid transparent`; hover/current border `--primary`, hover `scale(1.06)`), label under it 12.5px centered, tile width 92px, `gap:12px`, horizontal scroll, current one colored `--primary` | pill chips (`padding:7px 14px`, border, radius 999px) | M: `CategoryNode.image` exists in `lib/types.ts` so circle thumbnails can use the real image; fall back to the pill if no image. (Mockup `.chipl` pills are only used on search pages.) |
| C3 | `Listing.module.css:271-306` | `.lst-grid {gap:24px}` at all widths, `grid-template-columns: 264px 1fr` at >= 1024px | gap 16px < 1024px, 24px above; sidebar `250px` | S |
| C4 | `ProductGrid.module.css:14-25` (`.compact`) + `Listing.tsx:313` | listing grid: 2 cols mobile, **3 cols 641-1023px**, 4 cols >= 1024px | 4 cols from 641px (the `.compact` rule only caps 6 -> 4) | S: add a 3-col step at 641-1023px for `.compact` |
| C5 | Mobile filter bar: `Listing.module.css:10-51`, `Listing.tsx:262-285` | `.lst-bar` (<=1023px): `position:sticky; top:var(--hdr-h); background:var(--bg); border-bottom:1px solid var(--border); margin-inline:-12px; padding:8px 12px`; two equal ghost buttons (Filter with a `.fc` count bubble, Sort); sort opens a bottom sheet with radios; the inline sort `select` is desktop-only | Filter button + count + sort select in one wrapping row; not sticky; no Sort sheet | M-L, **needs browser check**. Sticky bar is M; a sort bottom-sheet would change behaviour (select -> sheet) so only the sticky Filter/Sort row with the existing `select` is proposed. |
| C6 | `Listing.module.css:41-51` (`.fc`) | primary bubble: `min-width:20px; height:20px; padding:0 5px; radius:10px; background:var(--primary); color:var(--on-primary); 11px` | accent bubble, 18px | S |
| C7 | `Listing.module.css:17-36` (`.count`, `.sort`) | `.lst-top .count {color:var(--text); font-size:14px}`; sort select `border-radius:var(--r-sm)`, `padding:8px 10px` | count is `--muted`; select radius `--r` | S |
| C8 | `Listing.module.css:57-67,271-306` (`.filters` desktop panel) | `padding:8px 16px; border:var(--card-bd); border-radius:6px; box-shadow:var(--sh-1); background:var(--surface)`; sheet radius `--r-lg` (6px) top corners; max-width 640px centered sheet on tablet | sheet radius `12px 12px 0 0`; panel has no shadow | S |
| C9 | `Listing.module.css:121-158` (`.group summary`) | `.fgroup summary`: normal case, 13.5px (body), `min-height:28px`; chevron is a rotated 8px L-border arrow (`rotate(45deg)`, open `-135deg`); `.fgroup {padding:12px 0; border-bottom:1px solid var(--border)}`; `.fg-b {margin-top:8px; max-height:260px}` | uppercase 12px `letter-spacing:.03em`, "+" / "-" glyphs | S-M. Note brand-d.css does not uppercase facet titles; app added it. Needs lead's call (keep or match). |
| C10 | `Listing.module.css:159-181` (`.opt`) | `.fopt {gap:8px; min-height:30px; padding:3px 0}`, checkbox/radio 18px, `em` count `margin-left:auto; 12px muted`; colour attribute rows show a round 18px swatch `.sw` | 16px checkbox, min-height 32px; no swatch | S (checkbox 18px); swatch only if facet data has a hex (needs data check) |
| C11 | `Listing.module.css:196-223` (`.pill`, `.clear`) | `.pill {min-height:30px; padding:4px 10px; background:var(--surface-2); font-size:12.5px}`, hover border `--danger`, trailing close icon 14px; `.pill-clear` underlined | `background:var(--surface)`, hover border `--primary`; app pills have the remove icon (`Listing.tsx:294-297`) | S |
| C12 | `Listing.module.css:225-238` (`.empty`) | `.empty` shared box (see G15): 🔎 icon 44px, h2 20px, primary button "Clear filters" | h2 18px, no icon, no clear button | S (+ a "Clear filters" button using the existing `clearHref` = behaviour-neutral link, **ASK**) |
| C13 | `Listing.module.css:240-269` (`.pager`) | Mockup uses a "Show more" ghost button + "Showing a of b" (no numbered pager) | numbered pagination (SEO-friendly links) | Keep app behaviour. Visual: `.pg` min 38x38, radius `--r`; fine. Not a gap. |
| C14 | Results header count | `N results` / `1 result` plural; "Showing a of b" | exists in app | OK |
| C15 | Crumbs/page padding | see G16, G17 | | S |

Category gap count: S x8 (C3, C4, C6, C7, C8, C10, C11, C12), M x3 (C1, C2, C9/C5 partly), L x1 (C5 if the sheet is wanted).

### 3.3 Search (`/search`)
Mockup: `search.html` -> `page-search.js`. App: `app/[lang]/search/page.tsx`, shared `Listing`.

| # | File:line | Mockup | App | Size |
|---|---|---|---|---|
| S1 | `app/[lang]/search/page.tsx:56`, `Page.module.css:1-4` (`.title`) | `.srch-h h1 {font-size:26px; line-height:1.25}` (20px mobile), `.srch-h {margin:8px 0 12px}`; optional muted line "in {category}" | 22px, no mobile size | S |
| S2 | Listing area | same as category (C3-C12) | same component | covered by C-items |
| S3 | Zero-result page | `.empty` box with 🔎, title `We couldn't find anything for "q"`, hint, **search tips** list (`.tips`), then "Popular searches" chips (`.chipl` pills), "Browse categories" chips, "Popular products" grid | the Listing's own empty box (`Listing.module.css:225-238`) / `EmptyState` | Restyle part S (G15); extra blocks are NOT BUILT (section 4) |
| S4 | Pill style `.chipl` for related categories / popular searches (`min-height:34px; padding:6px 14px; border:1px solid var(--border); radius:999px; hover border+text primary; em count 12px muted`) | exists only on the search pages | `Page.module.css:26-35 .chip` is the same look (padding 7px 14px) | OK (reuse for C2 fallback) |

### 3.4 Product (`/p/[slug]`)
Mockup: `product.html` -> `page-product.js`, `pages.css` section 4. App: `app/[lang]/p/[slug]/page.tsx`, `features/browse/{ProductView.tsx,Product.module.css,ProductRow,RecentlyViewed,YouTubeLite}`, `features/promotions/{FlashBox,CouponsSection,CouponCard}`.

| # | File:line | Mockup | App | Size |
|---|---|---|---|---|
| P1 | `Product.module.css:1-16` | `.pd-top {gap:24px; margin-bottom:24px}`; at >= 1024px `grid-template-columns: minmax(0,1.05fr) minmax(0,1fr); gap:32px`; gallery `position:sticky; top:hdr+16px` | `minmax(0,5fr) minmax(0,6fr)` from 900px, gap 24px, sticky `top:96px`, `margin-top:12px` | S |
| P2 | `Product.module.css:19-88` gallery | main frame `border-radius:6px; border:var(--card-bd); background:var(--surface-2); aspect-ratio 1/1`; **mobile edge-to-edge** (`margin-inline:-12px; border-radius:0; border-left/right:0`); swipe track with pill dots (7px dots, active 18px wide primary); desktop thumbs row `72px`, radius `--r-sm`, `border:2px solid var(--border)`, active/hover `--primary`; big **heart** top-right 12px/40px; "zoom" hint chip; video tile | frame same radius/border but `background:var(--surface)`; thumbs `64px`, radius `--r`; counter pill bottom-right instead of dots; always-visible thumbs; no heart over the image (heart is in the CTA row) | M (mobile full-bleed + 72px thumbs + radius); L for swipe slider/dots (behaviour); zoom hint NOT BUILT |
| P3 | `Product.module.css:91-94` (`.title`) and `base.css:73-76` | `.pd-title {font-size:24px; line-height:1.3; font-weight:400}` (19px mobile); not bold | 22px/1.3 weight 700 (19px mobile OK) | S |
| P4 | `Product.module.css:95-106` (`.meta`) | `.pd-meta {gap:4px 10px; margin:8px 0 12px; font-size:13px; color:var(--muted)}`, rating row `.pm-r` uses `--text`, "·" separators | `gap:8px 16px; margin-top:8px`; 13.5px, muted only on "no reviews" | S |
| P5 | `Product.module.css:123-133`, `Price.module.css:26-34` | `.pbox {padding:16px; box-shadow:var(--sh-1); border:var(--card-bd); radius:6px}`; `.pp-now` 32px/1.1 (26px mobile), `.pp-old` 16px, `.pp-sub` 13px muted | `.pbox` padding `12px 16px`, no shadow; `.lg .price` 28px, old 15px | S |
| P6 | `promotions.module.css:25-33` (`.flashBox`) + `FlashBox.tsx` | **Flash bar** `.flashbar`: full-width strip at the top of `.pbox` (`margin:-16px -16px 12px; padding:8px 16px; border-radius:6px 6px 0 0; background:var(--flash-bg); color:var(--flash-fg)`), bolt icon + "Flash Sale" + countdown boxes + spacer + "left" text | bordered `--sale` box inside `.pbox` with badge + text countdown | M: needs T6-T8, T14, T15; reuse H5 countdown |
| P7 | `Product.module.css:134-187` options | `.opt-l {color:--text; margin-bottom:8px}`; size button `min-width:52px; min-height:40px; radius:--r-sm`; **selected**: `border-color:--primary; background: color-mix(in srgb,var(--primary) 12%,var(--surface)); color:--primary; box-shadow:0 0 0 1px var(--primary)`; **sold-out**: `background:--surface-2; color:--muted; text-decoration:line-through`; swatch selected: `border-color:--primary; box-shadow: inset 0 0 0 3px var(--surface), 0 0 0 1px var(--primary)`; sold-out swatch: opacity .4 plus a 2px `--danger` diagonal bar | label `--muted`; size `min-width:44px`, radius `--r`; selected only recolors border + 1px outline + text; unavailable = opacity .55/.3 + line-through; no diagonal bar | M (all in one CSS module) |
| P8 | `Product.module.css:188-202` (`.stock`) | `.stock {display:flex; gap:6px; margin-top:12px}`; low/out use `--danger`; `pre` = primary | `margin-top:16px`; low uses `--sale` (dark differs) | S |
| P9 | `Product.module.css:203-209` (`.note` pre-order / upcoming) | `.prebox {display:flex; gap:10px; margin-top:12px; padding:12px; border:1px solid var(--accent); border-radius:--r; background: color-mix(in srgb,var(--accent) 14%,var(--surface))}` + info icon (18px) | left 4px primary bar on `--surface-2` | S |
| P10 | `Product.module.css:210-242` (`.qtyRow`, `.stepper`) | `.qty-row {margin-top:12px; gap:16px}`; `.stepper {border-radius:--r-sm; overflow:hidden}`, buttons 40x40 on `--surface-2`, input 52px wide centered | gap/margin 16px; radius `--r`; transparent buttons; output 44px with inline borders | S |
| P11 | `Product.module.css:243-253,424-432` (`.ctas`) | `.pd-cta {gap:12px; margin-top:16px}`; each button `flex:1; padding:14px 20px`; heart: `50px` wide square with `1px solid var(--border)`, `radius:--r`, `background:--surface`; desktop only (mobile uses the sticky bar) | buttons `min-width:150px; padding-block:12px`, gap 8px; heart 36px round; shown on mobile too | S |
| P12 | `app/[lang]/p/[slug]/page.tsx:218-262`, `Product.module.css:295-303` (`.sec`, `.rowSec`) | `.pd-sec {margin-bottom:32px; scroll-margin-top}` with **no top border**; `.sec-head` bar heading (app already uses it) | `border-top:1px solid var(--border); padding-top:24px; margin-top:var(--sec-gap)` | S |
| P13 | `Product.module.css:348-366` (`.specs`) | `.tbl-kv`: `th {width:34%; background:var(--surface-2); color: var(--text)}`, **all cells** `border:1px solid var(--border)`, padding `10px 12px`, 480px-wide mobile th 42% | `th` width 38%, color muted, only bottom borders, padding `10px 14px`, max-width 720px | S |
| P14 | `Product.module.css:304-347` (`.prose`) | `.rich h3 {margin:16px 0 8px; font-size:16px}`, `.rich p {max-width:70ch; color:var(--muted)}`, `.ticks` list with green checkmarks | `max-width:80ch`, text color `--text`, `line-height:1.7` | S, needs browser check (CMS HTML; muted body may hurt readability, lead's call) |
| P15 | `ProductRow.tsx`/`Product.module.css:401-423` (`.row`) | related/recent = `.band` + `.hscroll` cards 176px (recent `.rv` 136px, `card.xs`), heading with the D bar | grid-auto-columns 160-200px (6-up >= 1024px), heading already `sec-head` | S |
| P16 | `CouponsSection`/`CouponCard`, `promotions.module.css:119-204` | `.pd-box` card (padding 16, shadow, `.pd-h` 15px) inside the right column under the CTA, `.coupon` rows: dashed `--primary` border, `padding:10px 12px`, `background: color-mix(in srgb,var(--primary) 6%,var(--surface))`, `.cp-t` text + `b` 15px primary, collect button | section is full-width **below** the whole top block; cards `border:1px dashed var(--primary)`, `--r-lg`, `padding:12px`, no tint | M: move into the info column (**ASK**: layout change) and add the tint; restyle only otherwise |
| P17 | Toast `Product.module.css:260-293` | `.toast {bottom:92px (100px mobile); padding:10px 16px; border-radius:--r; max-width:min(92%,460px)}` | radius `--r-lg`, `bottom: 24px+56px` | S |

Product gap count: S x11 (P1, P3, P4, P5, P8, P9, P10, P11, P12, P13, P17), M x4 (P2, P6, P7, P16), L x1 (P2 swipe slider). P14/P15 S.

### 3.5 Cart (`/cart`)
Mockup: `cart.html` -> `page-cart.js`, `pages.css` section 6. App: `app/[lang]/cart/page.tsx`, `features/cart/{CartView.tsx,cart.module.css,QtyStepper}`, `features/promotions/CartCoupons.tsx` + `cartcoupons.module.css`.

| # | File:line | Mockup | App | Size |
|---|---|---|---|---|
| K1 | `CartView.tsx:107-111`, `base.css:222` (`.page-title`) | `.pg-h {margin:16px 0}` with `h1 {26px/1.2}` (22px mobile) and the item count aligned baseline right | `.page-title` 22px, `margin-bottom:16px` | S |
| K2 | `cart.module.css:10-16,220-228` | `.cart-grid {gap:24px}` columns `minmax(0,1fr) 380px` from **1024px**, summary sticky `top:hdr+16px` | gap 16px, `1fr 340px` from 960px, sticky 96px | S |
| K3 | `cart.module.css:25-33` (`.line`) | `.cline {padding:16px; box-shadow:var(--sh-1); gap:8px 16px; radius:6px}`; grid areas: checkbox, **96px image**, main, buy column (price 17px primary, "You save", stepper, line total 14px), then an actions row (Move to wishlist, Remove) | padding 12px; no shadow; 72px thumb mobile / 96px >= 720px; remove inside buy column | M |
| K4 | `cart.module.css:125-157` (`.stepper`) | `.stepper {border:1px solid var(--border); border-radius:var(--r-sm); overflow:hidden}`, buttons 40x40 on `--surface-2`, input 52px, `min-height:40px` | 36px buttons transparent, radius `--r`, input 44px | S |
| K5 | `cart.module.css:57-95` text | `.cl-t {font-size:14.5px; -webkit-line-clamp:2}`, `.cl-v` muted variant text, `.cl-warn` 12.5px with info icon (low-stock in accent-ish `warn`, errors in `--danger`) | name unclamped, 12px problem text without icon | S |
| K6 | `cart.module.css:158-166` (`.summary`) and `CartView.tsx:127-165` | `.sumbox {padding:16px; box-shadow:var(--sh-1)}`, `.sumbox-h` 17px, `.sum` rows (dt muted, dd right), **total row** `.sum-t` (border-top, label 16px, value 21px primary) | no shadow; title 16px; no total row (delivery is only known at checkout, so none is possible) | S (shadow, 17px); the total row is NOT BUILT |
| K7 | `cartcoupons.module.css:1-82` | coupon box `.cp-form {gap:8px}` with an uppercase input (placeholder not uppercase) + apply button; applied codes as `.cp-chip` pills (green tint, close icon button 26px); suggestions as `.chipl` pills (`.is-dis` 50% opacity); wallet link | input and apply grid (`1fr auto`); applied rows as dashed tags; suggestions as underlined text buttons | M (restyle only; keep all handlers) |
| K8 | `States.module.css` / empty cart (`CartView.tsx:85-100`) | `.empty` box with 🛒 (44px), h1 20px "Your cart is empty", button "Start shopping", then "Popular right now" product grid | `EmptyState` (no icon, no suggestions) | S (G15); suggestions grid NOT BUILT |
| K9 | Mobile line layout | below 640px `grid-template-columns: auto 72px 1fr` + rows buy/act full width | single card, buy row under with top border (`cart.module.css:96-105`) | S, **needs browser check** |

Cart gap count: S x6, M x2 (K3, K7).

### 3.6 Checkout (`/checkout`)
Mockup: `checkout.html` -> `page-checkout.js`, `pages.css` section 7 + 5. App: `app/[lang]/checkout/page.tsx`, `features/checkout/{CheckoutForm.tsx,Summary.tsx,AddressFields,SelectField,OtpBlock,checkout.module.css}`.

| # | File:line | Mockup | App | Size |
|---|---|---|---|---|
| O1 | `checkout.module.css:13-31`, `CheckoutForm.tsx:259-262` (`.card`, `.cardTitle`) | `.cks {padding:16px 24px; margin-bottom:16px; box-shadow:var(--sh-1)}`; `.cks-h` 17px with a **numbered circle** `.cks-n` (28px, `--primary` bg, `--on-primary`, 14px) before the title; mobile full-bleed (`margin-inline:-12px; border-left/right:0; radius:0; padding:16px`) | `.card {padding:16px}`, title 16px, no number badge, no shadow | M (number badge is presentational; add a counter via CSS `counter-increment` to avoid markup change) |
| O2 | `checkout.module.css:50-80` (`.choice`) | `.rcard .rc-b`: `border:2px solid var(--border); border-radius:--r; padding:12px 16px 12px 16px; padding-right:40px`, a custom 20px **radio circle on the right** (`.rc-b::after`), checked: `border-color:--primary; background: color-mix(in srgb,var(--primary) 8%,var(--surface))` + filled dot; hover border mix 60%; payment-method cards have a `.mchip` 38px icon chip | `border:1px`, native radio on the left, checked tint 6% | M |
| O3 | `checkout.module.css:96-157` summary | `.sumbox` (17px title with "Edit cart" link `13px`), `.irow` items: **52px** image, 2-line name 13px, price right, `padding:8px 0`, divider; `.sum` rows; `.sum-t` total 21px primary with top border; place-order `.btn.btn-primary.btn-lg.btn-block` **inside the box** (`.sum-co .btn`); terms checkbox above it | summary has 48px image, rows, total `16px` (not primary/21px), place-order button below the form (`CheckoutForm.tsx:431`) | M (+ **ASK** whether to move the button into the summary: it is a layout/markup move) |
| O4 | `checkout.module.css:158-166` | `.co-grid {gap:24px}`; `minmax(0,1fr) 400px` from 1024px; sticky `top:hdr+16px` | gap 16px, `1fr 380px` from 960px, sticky 96px | S |
| O5 | `account.module.css` `Field`: `Field.tsx`, `styles/base.css:186` | `.fld` label 13px, `.inp` min-height 44px radius 3px, error `.fld-e` 12.5px danger, hint `.fld-h` 12px; two-column rows `.two` (`gap:0 16px`) collapsing under 640px | label 13px OK; inputs per G19; address pairs are stacked in app (single column `.fields`) | S (G19), M for the two-column pairs (**needs browser check**, depends on `AddressFields` order) |
| O6 | `checkout.module.css:36-44` errors | `.alert` boxes: `border:1px solid var(--border); background:var(--surface-2); radius:--r; padding:12px 16px`, `.alert-warn` accent tint, `.alert-ok` success tint | `.error` plain red text / `.errorBox` | S |
| O7 | Free-form `Contact` block | `.ct-user`: 40px avatar circle (`--primary`, initial letter) + name + phone + "Change" link | text only (`CheckoutForm.tsx:264-270`) | S (avatar from the first letter; no new data) |
| O8 | Header | `.stepsx` 3-step trail (Cart > Checkout > Done) in the page header | none | NOT BUILT? It is a presentational element; **ASK** (section 4 lists it) |
| O9 | Mobile sticky total bar | `.sbar-in`: total + button, replaces bottom nav | none | NOT BUILT (G14) |

Checkout gap count: S x5 (O4, O5a, O6, O7, +G19), M x3 (O1, O2, O3).

### 3.7 Order success (`/order/[orderNo]`)
Mockup: `order-success.html` -> `page-success.js`, `pages.css` section 8. App: `app/[lang]/order/[orderNo]/page.tsx`, `features/checkout/SuccessView.tsx`, `checkout.module.css:168-221`.

| # | File:line | Mockup | App | Size |
|---|---|---|---|---|
| X1 | `SuccessView.tsx:71-75`, `checkout.module.css:176-184` (`.tick`) | `.os-hero {text-align:center; padding:32px 0 16px}`; `.pay-ic.good` 72px circle with 15% success tint, icon 36px in `--success` (not a solid green disc); `h1` 28px (23px mobile) | left-aligned column max 640px; 56px **solid** `--success` circle, 30px icon; title `.page-title` 22px | S-M |
| X2 | `SuccessView.tsx:79-102`, `.facts` | order number line: `.os-no` 16px with `b` 20px and a "Copy" link-button; two big buttons centered (`.os-act`, primary Track + ghost Continue) | `dl` grid with big 18px values | M (restyle; the Copy button is NOT BUILT) |
| X3 | layout | `.os-grid {gap:16px}` two columns `1.3fr 1fr` >= 641px: left card "Order summary" with item rows + totals; right column cards Payment, Address + ETA, Next steps (vertical timeline `.tl-v` with numbered dots) | single column, "What happens next" as a decimal `ol` (`checkout.module.css:204-211`) | L: item rows, address and payment are not in the placed-order response used here (**needs data check**); the Next-steps card can be restyled as a timeline (M) |
| X4 | `SuccessView.tsx:146-153` guest hint | `.acc-cta` card: `border-color:var(--accent); background: color-mix(in srgb,var(--accent) 10%,var(--surface))`, 52px accent icon disc, h2 17px, accent button "Create account" | muted paragraph + inline link | M (card styling; link target unchanged) |
| X5 | recommendations | `.os-rec` product row | none | NOT BUILT |

Success gap count: S x1, M x3, L x1.

### 3.8 Track (`/track`)
Mockup: `track.html` -> `page-track.js`, `pages.css` section 8. App: `app/[lang]/track/page.tsx`, `features/orders/{TrackForm.tsx,Timeline.tsx,orders.module.css}`.

| # | File:line | Mockup | App | Size |
|---|---|---|---|---|
| R1 | `orders.module.css:219-236`, `TrackForm.tsx:111-141` | form in a card: `.trk-box {max-width:480px; margin:32px auto}` + `.trk-f.card-box` (padding 16, shadow, border), h1 23px, field gap 12px, full-width primary `.btn-block` | `.trackWrap` 560px, no card; h1 22px; button inline | M |
| R2 | `orders.module.css:81-216` | result: `.trk-h` (h1 24px + status **pill** `.pill-ok/.pill-info/.pill-bad`: `padding:3px 11px; radius:999px; 12px; tinted bg 12-15%, border 40%`) and a two-column `.trk-grid {1.5fr 1fr}` >= 1024px: timeline card + side cards | `.badge` (radius 3px, `st_*` tints) in a single column | S (pill radius/padding) / M (two-col) |
| R3 | `Timeline.tsx`, `orders.module.css:171-216` | timeline `.tl`: **28px numbered/check dots** `.tl-dot` (`border:2px solid var(--border)`, done = filled `--primary` with check, current = ring `0 0 0 4px color-mix(primary 20%)`), connector `2px` (done = `--primary`), step title 13.5px, `small` 12px; horizontal variant `.tl-h` at >= 641px (columns, centered) | 14px plain dots, connector `--border`, current dot primary only | M |
| R4 | card chrome | `.card-box` shadow `--sh-1`, `margin-bottom:16px` | `.card` has no shadow (`orders.module.css:108-117`) | S |
| R5 | Payment status row (`.pay-st`), shipment cards (`.ship`, `.sh-t` with courier tracking), "Cancel order" etc. | present | none (track response has status, dates, masked phone) | NOT BUILT |

Track gap count: S x2, M x3.

### 3.9 Login / Signup / Reset (`/login`, `/signup`, `/reset`)
Mockup: `login.html` -> `page-login.js` + `auth.js`, `pages.css` section 9. App: `app/[lang]/{login,signup,reset}/page.tsx`, `features/account/{LoginForm,SignupForm,ResetForm,Field,account.module.css}`.

| # | File:line | Mockup | App | Size |
|---|---|---|---|---|
| L1 | `account.module.css:1-17` (`.card`) | `.lg-main.card-box`: padding 24px, shadow `--sh-1`; `.au-h h1` 21px; `.lg-grid` 2 columns `1fr 1.1fr`, `max-width:980px` on >= 1024px with a **side panel** (gradient `--sl1`, white text, benefits list, 90px emoji) hidden below 1024px | single card 440px centered (already has shadow and padding 24px); h1 22px | S (h1 21px, card is OK). Side panel: NOT BUILT |
| L2 | `account.module.css:18-62` (`.field`, `.label`, `.pw`) | `.fld` gap 6px; `.inp` 44px; "Show/Hide" toggle inside the field `.inp-tg` (primary, padding 8px, right 6px) | gap 4px; toggle fine | S (G19) |
| L3 | `account.module.css:63-70` (`.code`) | OTP: **6 separate boxes** `.otp-b` (`height:52px; font-size:22px; radius:--r-sm; max-width 340px; gap:8px`), centered; "Resend" below | one input with `letter-spacing:.4em` | M-L: changes input structure (6 inputs) and needs paste/backspace handling = behaviour. **ASK**; otherwise S (keep the single box, add `height:52px; border-radius:--r-sm; max-width:340px; margin:auto`) |
| L4 | `account.module.css:64-77` (`.alert`, `.ok`) | `.alert {border:1px solid var(--border); background:var(--surface-2)}` + variants warn (accent 14%) / ok (success 10%); error text `--danger` 12.5px | red border + red text 8% tint | S |
| L5 | `account.module.css:98-104` (`.foot`) | `.au-sw {margin-top:16px; text-align:center}` (no divider line); "or continue with" divider + Google/Facebook buttons | border-top divider | S |
| L6 | Login/Signup tabs `.au-tabs` (two equal tab buttons, 3px bottom indicator) | present | separate pages with a footer link | NOT BUILT (navigation pattern) |

### 3.10 Account (`/account`, `/account/orders`, `/account/addresses`, `/account/coupons`, `/account/returns`, `/wishlist`)
Mockup: `account.html` -> `page-account.js` (65 KB, many tabs), `pages.css` section 10. App: `app/[lang]/account/**`, `wishlist/`, `features/account/*`, `features/orders/*`, `features/returns/*`, `features/promotions/{WalletList,CouponCard}`.

The mockup account is a two-column shell (sidebar nav 264px + main). The app has no shared account shell; each page is standalone. A sidebar is a new element (section 4); the gaps below are for existing pieces.

| # | File:line | Mockup | App | Size |
|---|---|---|---|---|
| A1 | `account.module.css:128-152` (`.tile`) | dashboard stats `.stat`: `padding:12px 16px; box-shadow:var(--sh-1); radius:--r`; hover `border-color:--primary; transform:translateY(var(--lift))`; value 22px, label 12.5px | `.tile` padding 16px, radius `--r-lg`, hover border only | S |
| A2 | `account.module.css:113-122` (`.panel`) | `.card-box {padding:16px; box-shadow:var(--sh-1)}`; section heading `.sec-h3` 15px | padding 24px; no shadow; h2 16px | S |
| A3 | `account.module.css:162-166` and `account/page.tsx:46-49` | `.dash-hello h1 {22px}` with avatar circle 56px (`.ct-av-lg`) | text h1 + logout button | S (avatar disc from the initial) |
| A4 | `orders.module.css:12-72` (`.orderRow`, `.badge`) | order list `.ocard`: header strip (`background:--surface-2; padding:12px 16px`: order no, date, status pill), body (thumbs `.pths` 52px stack with "+N", summary column right-aligned: total `b` 16px, items count), footer actions row (Track, Invoice, Return) separated by a top border; shadow `--sh-1` | single clickable grid row (64px thumb, text, status badge) | M |
| A5 | order tabs `.tabs` (All / Pending / ... with count bubbles) | present | none (filter would be a feature) | NOT BUILT |
| A6 | `orders.module.css:238-283` (`.addrCard`) | `.acard {padding:16px; box-shadow:--sh-1}`, default one `border-color:--primary`, header chips (`.tagx`: Default, label), footer links row `gap:16px` | same structure, no shadow; default state OK | S |
| A7 | coupon wallet: `promotions.module.css:119-204` and `WalletList.tsx` | `.tkt` **ticket**: 3 columns `96px 1fr auto`, left block `--primary` with the value (15px, `--on-primary`) and a `2px dashed var(--bg)` right edge, body (name 15px, facts 12.5px), action column; expired `opacity .6` with muted block | dashed `--primary` card, column layout | M |
| A8 | returns lists/forms (`returns.module.css`) | `.retitem` rows: checkbox 20px + `.irow` + qty select, selected `border-color:--primary` tint 7%; `.photo` tiles; `.ret-sum` | custom CSS exists; hard-coded `#fff` at `returns.module.css:48` | S: tokenise that `#fff` -> `var(--on-primary)` or `--on-sale`; rest follows O2 pattern |
| A9 | `account.module.css:168-182` (`.remove`) wishlist remove | `.wl-grid {grid-template-columns: repeat(auto-fill,minmax(160px,1fr))}`, a plain "remove" below each card | 36px round remove button, grid via `ProductGrid` | S, needs browser check |
| A10 | `features/returns/invoice.module.css` hex colors | n/a (printable invoice) | `#fff #111 #555 #ddd` | OK (print stylesheet, intentionally light) |

### 3.11 Offers (`/offers`) <- `event.html`
Mockup: `event.html` -> `page-event.js`, `pages.css` section 11. App: `app/[lang]/offers/page.tsx`, `features/promotions/{FlashSales.tsx,CouponsSection,CouponCard}`.

| # | File:line | Mockup | App | Size |
|---|---|---|---|---|
| E1 | `offers/page.tsx:34`, `FlashSales.tsx:30` | sections use `.sec-head` bars; flash block is a `.band.flash` | plain h2 18px | M (H1/H4) |
| E2 | `promotions.module.css:83-100 (.cards)` | event product grid `.grid` 2/4/6 cols; tile hover border | grid 2/4/6 - OK | OK |
| E3 | coupons | `.tkt-ev` tickets in a horizontal `.hscroll.evc` (`flex:0 0 min(360px,88%)`) | 3-col grid of dashed cards | M (A7) |
| E4 | hero banner `.event.ev-hero` (gradient `--ev0`, h1 40px, countdown, CTA, art) | present | none | NOT BUILT (no event/page-builder data; P3 per CLAUDE.md) |

### 3.12 Pages with no mockup (kept, restyled by the nearest pattern)
`/wishlist` (see A9), `/signup`, `/reset` (L-items), `/pages/[slug]` (CMS text: use `.rich` rules from P14), `not-found`/`error` (G15 box), `/order/[orderNo]/invoice` (print), `/account/returns/*`. No separate gaps.

---

## 4. NOT BUILT (for later: mockup elements without a feature, data or route in the shop)

Header/footer/global
- Util bar links "Sell on ShopName" and "Help" (no seller or help page).
- Header search category `<select>` (decide with lead whether to wire it: G3).
- Footer: newsletter signup band, social icons, app-store badges, courier note, payment chips Card/bKash/Nagad (online payments off), links Careers, Blog, How to order, Delivery, Returns, FAQ.
- Cookie consent bar (`.cookie`).
- Sticky action bar slot `.sbar` above the mobile bottom nav (product: add to cart + heart; cart/checkout: total + button).

Home
- Gradient text slides (kicker, h2, text, CTA, emoji art): the carousel is image-only (`HomeSlide` has only title, link, images).
- Event/promo banner bands between product groups; flash band cards with sold-progress bar (`.prog`, needs sold/total).

Category/search
- Free-delivery rule text in the category banner (`D.freeRule`).
- Sort bottom sheet for mobile (select stays).
- Search: "Did you mean", related-category chips, popular searches, popular products fallback, "Search tips" list; zero-result product suggestions.
- Colour swatch facet rows and the "rating" and "discount" facet groups only if the facets API provides them (**needs data check**: not audited).

Product
- Tab bar `.ptabs` (Description / Specs / Reviews / Q&A) and sticky behaviour.
- Reviews summary, rating bars, review list with photos, helpful vote, Q&A (step 8).
- Delivery estimate box (district picker + ETA), "assure" list (COD, returns, warranty), seller box, warranty row.
- "Notify me" back-in-stock form; image zoom on hover; gallery video tile; share.
- Coupon box placement in the right column (exists, wrong place: P16).

Cart
- Select-all bar and per-line checkboxes (`.cart-sel`, `.cl-chk`), "Move to wishlist" line action, free-delivery progress bar (`.fd-bar`), cart total/VAT/points/wallet rows, popular products on empty cart, drop-ship / pre-order line tags (`.tagx`).

Checkout
- Steps trail `.stepsx`, loyalty points slider (`.pts`), wallet/store-credit and affiliate code, advance-payment split (`.sum-split`, `.adv-why`), delivery parcels breakdown (`.dl-top`, `.parcel`), online-payment method cards (bKash/Nagad/card, `.rcards-pm`), terms checkbox (not in app), mobile sticky total bar.

Payment (`payment.html`)
- Entire page: gateway redirect/return screen (amount, countdown, success/failed states, bKash/Nagad/card). `online_payments` flag is off; no route.

Success/Track
- Order items summary, address and ETA on the success page (response lacks them), "Copy order number" button, recommendations row, payment-status row, shipment cards with courier tracking link, order timeline in horizontal layout is restyle only.

Auth/account
- Login side panel, Login/Signup tabs, social login (Google/Facebook), 6-box OTP (unless approved: L3).
- Account shell sidebar (`.acc-nav` with avatar, icon links, notification badge), order status tabs, wallet balance page, points, notifications, support tickets, referral, reviews, preference toggles.

Event (`event.html`)
- Hero event banner, category tiles with "% off" line, paired promo banners, payment-offer banner, event coupon ticket row. Only flash sales and coupons exist (`/offers`).

---

## 5. Suggested fix order

Ordered by visible impact per effort; each step is independent and keeps behaviour.

1. **Tokens (S):** add T1-T8, T10, T11, T14-T16 to `styles/tokens.css` only if steps 4-6 are approved. Add Poppins 800 and set the logo to 800 (F2, F4).
2. **Global CSS batch (S, `styles/base.css` + small shell edits):** G9 (`.link` + chevron), G10 (17px mobile heading), G11 (20px mobile `--sec-gap`), G16-G19 (crumbs, page padding, `.btn-lg/.btn-block`, `.input` 44px/3px), G12 (heart), G15 (empty box), G20 (card shadows), G1, G4.
3. **Section headings to `.sec-head` (M):** H1 (home, flash strip, offers, special rows). Biggest brand-D cue still missing.
4. **Product page CSS module (M, one file):** P1, P3-P5, P7-P13, P17, P12.
5. **Listing polish (S-M):** C3, C4, C6-C8, C10-C12; then C1/C2 (banner and sub-category tiles); C5 only after a browser check.
6. **Cart and checkout cards (M):** K1-K5, K6 (shadow), K7; O1-O4, O6, O7.
7. **Flash treatment (L):** H4, H5, P6 (needs tokens T6-T8): one shared countdown-box component.
8. **Track, success, login (M):** R1-R4, X1-X4, L1-L5 (L3 after approval).
9. **Account (M):** A1-A4, A6, A7, E3; tokenise `returns.module.css:48` (A8).
10. Needs browser check before any work: C5, H3, H8, H10, K9, O5, P14, A9.

ASK items for the lead (cannot decide from the mockup alone): G3 (category select in header search), C12 (add a "Clear filters" button to the empty state), O3 (move "Place order" into the summary box), P16 (move coupons into the info column), L3 (6-box OTP), O8 (checkout steps trail), C9 (keep the app's uppercase facet titles?).

---

## 6. Done (fix pass, static only; typecheck, vitest 144/144 and `biome ci apps/shop` 0 errors)

Fixed: T1-T8, T10, T11, T14-T16, F2, F4 (tokens in `tokens.css`, Poppins 800, logo 800); G1, G4, G8, G9, G10, G11, G12, G15, G16, G17, G18, G19, G20; H1, H2, H3 (widths only), H4 (band, gradient, hl bar, 176px cards; no progress bar), H5 (countdown in one box, text unchanged, no per-unit boxes), H7; C1 (gradient banner with h1 inside when the category has no image; with an image the old layout stays), C2 (circular sub-category tiles), C3, C4, C6, C7, C8, C9 (follows mockup), C10 (checkbox size, count right), C11; S1; P1, P2 (mobile full-bleed, 72px thumbs, radius; no swipe slider), P3, P4, P5, P6 (flash bar at top of price box), P7, P8, P9, P10, P11, P12, P13, P15, P16 (coupons now in the info column), P17; K1, K2, K3 (padding, shadow, clamp; layout areas unchanged), K4, K5, K6 (shadow, 17px), K7; O1 (CSS counter badge), O2, O3 (already inside the summary box; button now `btn-lg` full width), O4, O6, O7; X1, X4; R1, R2, R4, R3 (28px check/ring timeline); L1 (h1 21px), L2, L4, L5; A1, A2, A6 (shadow), A7 (ticket coupon cards), A8 (`#fff` tokenised), E1, E3.

Skipped: G3, C12, L3, O8 (lead said no); all section 4 items; step 10 browser-check items (C5, H8, H10, K9, O5, P14, A9); X2/X3 (needs data and a copy button), A3, A4 (order card restructure is markup-heavy), A5, G2, G5-G7, G13, G14, H6, H9, H11, H12, S3, S4, K8 (suggestions), C13/C14/C15/R5, L6 (not built or already matching).

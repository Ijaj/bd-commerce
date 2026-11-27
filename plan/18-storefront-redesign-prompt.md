# Prompt: storefront redesign (for Claude Design)

Copy everything below the line into Claude Design, and attach `plan/19-storefront-pages-api.md` (data contract per page) and `plan/redesign-ref/current-shop.pdf` (current screens).

---

Redesign the storefront of a general-purpose e-commerce site for **Bangladesh**. The current design works but looks plain and template-like. I want it to look like a modern, production-ready shop that holds attention: strong visual hierarchy, sections that make people scroll, and tasteful motion ("eye candy") that feels premium, not gimmicky.

## Hard constraints (the design must be buildable in our stack)

- **No backend changes. Frontend only.** We are heading to a test deployment, so the redesign may only use data and actions the API already provides. `plan/19-storefront-pages-api.md` lists every page, the endpoints it calls, the fields it shows and what the API does *not* provide. Do not design anything that needs a new endpoint, field or setting (for example ratings, reviews, Q&A, per-area delivery dates or brand pages, unless doc 19 says the field exists). If an idea needs backend work, put it in a separate "later" list rather than in the design. Placeholder or decorative content (icons, illustrations, static trust-strip copy) is fine.

- **Stack:** Next.js 16 App Router, React 19, **plain CSS Modules + CSS custom properties**. No Tailwind, no component library, no new runtime dependencies. Motion must be pure CSS (transitions, `@keyframes`, scroll-driven animations with `animation-timeline` as progressive enhancement) or tiny vanilla JS (IntersectionObserver). Hand me designs as HTML/CSS I can port into CSS Modules.
- **Design tokens:** express every colour, radius, shadow, spacing and font size as CSS variables (`--bdc-*` naming). Keep a **light and a dark theme** (dark is set via `data-mantine-color-scheme="dark"` on `<html>`). Current palette for reference: primary indigo `#4338ca` (dark `#9a94ff`), accent teal `#0f766e` (dark `#2dd4bf`), bg `#f4f4fb` (dark `#0e0d1c`). You may refine or replace it, but give me the full token sheet.
- **Bilingual EN / বাংলা:** every layout must survive Bangla text (taller glyphs, ~20-30% longer strings). Pick a font pairing that has good Bangla support (e.g. Hind Siliguri / Noto Sans Bengali / Anek Bangla with a Latin display face). Bangla digits appear in prices on the BN site.
- **Currency:** prices in Taka, `৳1,250` style; show sale price + struck-through original + discount % badge.
- **Mobile first:** most buyers use cheap Android phones on slow mobile data. Design at **390px first**, then 768 and 1280+. Bottom-reachable actions on mobile (sticky add-to-cart, sticky checkout bar). Tap targets ≥ 44px.
- **Performance:** no autoplay video, no heavy blur stacks on large areas, no layout shift. Images are WebP from an image proxy, so design around fixed aspect ratios (product 1:1, banners 16:6 desktop / 4:3 mobile). LCP element on home = hero banner.
- **Accessibility:** WCAG AA contrast in both themes, visible focus rings, all motion disabled under `prefers-reduced-motion`.
- **Trust signals matter more than in Western shops:** Cash on Delivery, delivery times (static copy, e.g. Dhaka vs outside Dhaka), easy returns, genuine-product guarantee, hotline/WhatsApp. Make these visible without clutter.

## Features that exist and need a place in the design

Search with suggestions, category tree (max 4 levels) with facets/filters, brands, product variants (size/colour), wishlist, cart with coupon box + coupon suggestions, flash sales with countdown and limited stock, offers page, guest checkout (COD, phone OTP), order tracking, account (orders, returns, addresses, coupons wallet, affiliate referral link), announcement bar (admin-controlled), home carousel (admin-controlled slides), static pages (footer links from CMS), EN/BN language switch, light/dark switch.

## Pages to design (in priority order)

1. **Home** — the showpiece. Suggested section order (reorder if you have a better idea):
   - Announcement bar (dismissible, can hold a countdown).
   - Header: logo, big search (mobile: search row under logo), cart/wishlist badges, account, language + theme toggle; slim category mega-menu on desktop, drawer on mobile. Header shrinks on scroll.
   - Hero: carousel of promo banners with a clear CTA, progress-bar indicators, swipe on mobile; optional side tiles on desktop (reuse carousel slides 2–3; there is no other banner source).
   - Trust strip: COD · fast delivery · easy returns · 100% genuine (icons, compact).
   - Category rail: round or card icons, horizontally scrollable, with a subtle hover lift.
   - **Flash sale block:** bold, high-contrast, live countdown (flip or ticking digits), "X% claimed" stock bar on each card, horizontal scroller.
   - Featured categories: bento-grid of large image tiles with overlay titles.
   - "Just for you" / trending / new arrivals: product grids with tabs.
   - Tabbed rails (New arrivals / Popular / On sale) built from the existing product listing endpoint.
   - Recently viewed.
   - Infinite / "load more" product feed.
   - Help/contact CTA using the shop hotline and email (no newsletter backend exists).
   - Footer: CMS page links, payment/courier logos area, hotline, social, language switch.
2. **Product card** (used everywhere): single image (cards carry one image only) with a gentle hover zoom, discount badge, flash badge, new/pre-order/upcoming badges, wishlist heart with a pop animation, "N sold" text, price block, out-of-stock state, skeleton state. No rating stars (no review data) and no quick add-to-cart on cards (cards have no variant id; the card links to the product page).
3. **Product page:** gallery (thumbnails, pinch/zoom on mobile, hover zoom on desktop), title, price block, variant chips (colour swatches + size pills, disabled = sold out), stock hint ("Only 3 left"), static delivery/COD/returns copy plus the product's real warranty text, sticky add-to-cart bar on mobile, tabs or accordions for description/specs/warranty, similar products, share row.
4. **All-categories page (`/categories`), category / search listing:** filter sidebar (desktop) / bottom-sheet filters (mobile), sort, active-filter chips, result count, grid/list toggle, empty state, pagination or load more.
5. **Cart + checkout:** cart drawer (slide-in) and full cart page, coupon field + suggested coupons, clear order summary (a free-delivery progress bar is possible only in checkout, after an address is chosen, from `freeDeliveryRemainingP`); checkout as one calm page with numbered sections (contact & OTP → address with division/district/upazila → delivery → payment COD → review), sticky place-order bar on mobile; order success page with a celebratory moment (confetti or check animation, once).
6. **Order tracking:** timeline/stepper with courier name and tracking link.
7. **Account:** dashboard cards (orders, returns, coupons, referral earnings), orders list, order detail.
8. **Login / signup / OTP:** split layout desktop, single column mobile, OTP input with auto-advance boxes.
9. **Offers page** and **static CMS page** template.
10. Shared states: loading skeletons (shimmer), empty states with illustration slot, error/404 page, toasts.

## Eye candy I want (keep it tasteful and fast)

- Scroll-reveal: sections fade/slide up 12-16px as they enter (once, staggered children).
- Product image hover: gentle zoom; card lift with soft shadow.
- Add-to-cart (product page and cart): the cart badge bounces; button morphs to a qty stepper.
- Wishlist heart burst.
- Flash-sale countdown with animated digits and a pulsing "LIVE" dot.
- Animated gradient or subtle mesh behind hero / flash-sale section (CSS only).
- Skeleton shimmer instead of spinners.
- Sticky header that condenses; smooth drawer and bottom-sheet transitions.
- Micro-interactions on chips, toggles, tabs (sliding indicator).
- Glassmorphism only where it is cheap (header over hero), never on large scrolling areas.

## Style direction

Modern, clean, confident; generous white space, large rounded image tiles (radius 12-16px), crisp typography with a strong display size for section titles, one bold accent used sparingly for sale/urgency, soft layered shadows. Should feel at home next to the best regional and global shops (think Daraz/Shajgoj polish, Zara/Apple calm, Shopify Dawn-quality structure) without copying any of them. It must look like a real brand, not a theme demo.

## Deliverables

1. Token sheet (light + dark): colours, type scale (EN + BN), spacing, radius, shadows, motion durations/easings.
2. Component sheet: header, footer, buttons, inputs, chips, badges, product card (all states), price block, countdown, tabs, drawer, bottom sheet, toast, skeleton, breadcrumb, pagination, empty state.
3. Full-page designs for the pages above at **390px and 1280px**, light and dark for Home and Product at least, plus one Bangla version of Home and Product.
4. Motion notes per animation (trigger, duration, easing, reduced-motion fallback).
5. Clean HTML + CSS per page/component that I can port into CSS Modules, using only the tokens.

# Storefront redesign reference

Input for the storefront redesign (prompt: `plan/18-storefront-redesign-prompt.md`).

- `small/`: screenshots of the current shop (2026-11-27, light theme, EN, dev demo data), resized for low token cost.
  - `<page>-390-N.jpg`: phone (390 px wide, 1x), cut into slices up to 1500 px tall.
  - `<page>-1280-N.jpg`: desktop (1280 px shot, resized to 960 px wide), slices up to 1200 px tall.
  - Pages: home, category (`/c/electronics`), product (`/p/demo-aarong-classic-panjabi`), search (`?q=a`), offers, cart (1 item), checkout, track, login, signup, 404.
  - The phone bottom nav bar shows mid-page: an artifact of full-page capture on a fixed element, not a bug.
  - Key set (~11k tokens): home-*, product-*, category-1280-*, cart-390, checkout-390-*.
- `shoot.mjs`: retake full-page PNGs into `current/` (git-ignored). Needs the shop on :3100 (`./dev.sh`). Run: `cd e2e && node ../plan/redesign-ref/shoot.mjs`.
- `current-shop.pdf`: all 34 slices in one PDF (one labelled slice per page, key pages first), for single-file upload.
- `shrink.py`: rebuild `small/` and `current-shop.pdf` from `current/` (Pillow). Run: `python3 plan/redesign-ref/shrink.py`.

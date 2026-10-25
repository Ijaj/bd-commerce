# Step 6b — UI fidelity to approved mockups (C60)

Why: steps 1-6 built admin with stock Mantine + approximate colors (S-T8, never re-checked against mockups). Owner: mockups were the approved design; built UI is not. Fix it.

Source of truth: `plan/mockups/shared/brand-d.css` (tokens, light + dark), `plan/mockups/admin/shared/admin.css` (+ `sales.css`, `catalog.css`, `marketing.css`, `partners.css`, `sr.css`, `system.css`), `admin-core.js` (shell, `NAV`, `icons`), page JS per screen. SR/portal: `plan/mockups/sr/`. Storefront: `plan/mockups/*.html` + `shared/pages.css`.

## Gaps found (admin, 2026-10-25)
1. Colors: only primary/teal copied. Missing bg `#f4f4fb`, surface, surface-2, text `#1e1b3a`, muted, border `#dcdbef`, success/danger/sale, `--hl` `#5eead4`, whole dark palette.
2. Shell: Mantine AppShell 48px header / 220px navbar vs mockup 54px top bar / 236px dark sidebar (`#1e1b3a`, dark `#0b0a18`). Logo wordmark (uppercase italic, teal bold part + "ADMIN" tag), global search (teal 2px border), notifications bell, staff menu, "View store" missing.
3. Sidebar: no icons, headings not visible, no active left bar (`--hl`), wrong grouping/labels. Mockup groups: Overview / Sales / Catalog / Marketing / People & partners / System. Icon set = `Admin.icons` (inline SVG; port to a tiny icon component or use matching Tabler icons).
4. No light/dark switch (theme is `auto` only, tokens have no dark values). Persist choice (`shop.theme` key in mockups).
5. Page header, `.a-stat` tiles, tables, badges, tabs, buttons (uppercase, angular), cards, forms, toasts, modal/drawer: all stock Mantine.
6. Typography: DM Sans + Noto Sans Bengali in mockup admin; check the font actually loads in the app.

## Method
- Lead (one agent) builds foundation FIRST: CSS variables file mirroring brand-D tokens, `data-theme` + Mantine color-scheme sync, Mantine theme (colors from tokens, radius 4/3/6, shadows, fonts, `components` styles for Button/Badge/Table/Tabs/Paper/Modal/Drawer/Input/NavLink/Menu), new `AppLayout` shell, `PageHeader`, `StatTile`, `Badge` status mapping, icon component, nav data matching mockup grouping. Same for `apps/portal` (reuse; consider `packages/ui` shared by admin + portal).
- Then per-screen passes (Sonnet agents, max 3-4 at once, owned feature folders): each screen compared with its mockup page via headless Chromium screenshots (mockup file:// vs real app, light + dark, 1440px and 390px); fix until visually close. Keep behavior/tests intact; update tests only for changed markup.
- Menu mapping: mockup pages not built yet stay out of the menu until built; built pages the mockup lacks (Call queue, Shipments, Bulk sales, Home carousel, Brands, Import/Export, Delivery zones, Buyer shops, Collections...) go in the nearest group.
- Acceptance: screenshot pairs per page in `plan/swarm/ui-fidelity/`, owner review. Then shop: audit against mockups the same way (shop is plain CSS, brand-D tokens).
- Never again: any UI task must open the matching mockup page first and screenshot-compare before it is called done.

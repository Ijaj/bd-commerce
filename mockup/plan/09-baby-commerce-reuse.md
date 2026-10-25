# 09 — Lessons From baby-commerce

Old project: `~/webdev/baby-commerce` (Next.js + MUI, Express + TS, Sequelize/MySQL, BullMQ/Redis).

## Reusable ideas
- Category tree stored with a closure table (fast "all products under Electronics" queries). Our depth limit is small (3–4), so a simpler approach may also work — decide at data-model stage.
- Money stored in minor units (poisha, ×100) — avoids rounding bugs. Keep.
- First-party `PageView` tracker instead of only GA4 — same idea as our visitor tracking.
- Admin decisions that held up: one table component for all lists, standard pagination envelope `{data, page, pageSize, total}`, shared CSV export, global toast notifications, unified skeleton/empty/error states, audit log.
- Storefront checklist in `docs/storefront-options-and-menus.md`: header/footer menus, sort options, filters, product-page parts, cart edge cases (price changed, stock changed, coupon expired), checkout states (payment pending/failed), empty states. Use as a checklist when writing page specs.

## Things to avoid / do differently
- Started coding before plans were complete → admin built as one big page, rework later. This time: gates in README first.
- `sequelize.sync()` in early stages, migrations added later → use migrations from day 1.
- MUI is heavy for a storefront that must be lightweight; pick a lighter UI approach (tech decision later).
- Baby-specific concepts (shop by age, etc.) don't apply; replace with generic category attributes.
- Local image storage first → plan object storage + CDN + image resizing from the start.

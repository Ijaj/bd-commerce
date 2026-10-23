# bd-commerce

General-purpose e-commerce for Bangladesh. Planning docs live in [`plan/`](plan/README.md); decisions in [`plan/10-decisions-log.md`](plan/10-decisions-log.md).

## Requirements

- Node.js 24 (`.nvmrc`), pnpm 11 (`corepack enable`)
- Podman with `podman compose`

## Local dev

```sh
pnpm install
cp .env.example .env
pnpm stack:up      # Postgres 18, Redis 8, Garage (S3), imgproxy
pnpm stack:init    # first run only: Garage layout, dev key, buckets
```

| Service  | Address          | Notes                         |
| -------- | ---------------- | ----------------------------- |
| Postgres | `localhost:5432` | dbs `bdc`, `bdc_test`         |
| Redis    | `localhost:6379` | AOF on                        |
| Garage   | `localhost:3900` | S3 API, region `garage`       |
| imgproxy | `localhost:8080` | signed URLs, reads `s3://...` |

`pnpm stack:down` stops it; `pnpm stack:reset` also deletes the data volumes.

## Scripts

`pnpm check` (Biome lint + format), `pnpm fix`, `pnpm typecheck`, `pnpm test`, `pnpm build`.

API tests use `TEST_DATABASE_URL` (migrated on start, e.g. `bdc_test`) and Redis db `TEST_REDIS_DB` (default 1). For parallel test runs from different worktrees or agents, give each run its own `TEST_DATABASE_URL` database and `TEST_REDIS_DB`.

## API

`apps/api`: NestJS 11 + Prisma 7, compiled with SWC (TypeScript 7 type-check). `pnpm --filter @bdc/api dev` serves on `:4000`: `/health`, routes under `/v1`, Swagger UI at `/docs` (non-production).

After changing API routes or schemas run `pnpm api:gen`. It rewrites `packages/api-client/openapi.json` and the generated types; CI fails if they are stale.

### Staff accounts

Staff sign in at `/v1/admin/auth/*`: email + password, then a mandatory authenticator-app code (2FA). Sessions are httpOnly cookies, 8 h idle timeout, 7 day hard cap. Server-side commands (after `pnpm --filter @bdc/api build`):

```sh
pnpm --filter @bdc/api cli create-owner owner@example.com "Owner Name"   # prints a temporary password
pnpm --filter @bdc/api cli reset-2fa owner@example.com                    # last-resort 2FA reset
```

Dev mail (new-device alerts) lands in Mailpit: http://localhost:8025.

### Demo catalog (dev only)

```sh
pnpm --filter @bdc/api build
pnpm --filter @bdc/api cli seed-demo
```

Creates 16 categories, 8 brands, 30 products and their variants (EN + BN names). Idempotent: it does nothing when a product with a `demo-` slug already exists. Refuses to run when `NODE_ENV=production`. It is not run on any database automatically.

### Settings and feature flags

Defined in `apps/api/src/settings/registry.ts` (key, Zod schema, default, public or not). Only admin overrides are stored (`settings` table, cached in Redis). Admin: `GET/PUT/DELETE /v1/admin/settings/:key`. Shop/apps: `GET /v1/public/site` (maintenance, announcement bar, flags). Maintenance mode answers 503 on every API route except admin, site status, health and docs.

## Catalog

Admin routes are under `/v1/admin`, cookie auth, and each needs the permission in brackets. Money is stored in paisa.

### Categories

- Up to 4 levels deep. Main (level 1) categories need an image; sub-categories may have an image, icon and banner.
- Attributes belong to a category and are inherited by its sub-categories. Options are edited as one ordered list (`PUT .../options`), and array position becomes the sort order.
- Deleting a category needs a mode. `move` re-homes its products into a `targetId` category (`categories.delete`). `cascade` deletes the category, its sub-categories and their products (`categories.delete_with_products`). `GET /:id/delete-preview` shows the impact first.

| Method | Path                                       | Permission                                                        |
| ------ | ------------------------------------------ | ----------------------------------------------------------------- |
| GET    | `/admin/categories`                        | `categories.view`                                                 |
| GET    | `/admin/categories/:id`                    | `categories.view`                                                 |
| GET    | `/admin/categories/:id/delete-preview`     | `categories.view`                                                 |
| POST   | `/admin/categories`                        | `categories.create`                                               |
| PATCH  | `/admin/categories/:id`                    | `categories.edit`                                                 |
| POST   | `/admin/categories/reorder`                | `categories.edit`                                                 |
| DELETE | `/admin/categories/:id`                    | `categories.delete` or `categories.delete_with_products`, by mode |
| POST   | `/admin/categories/:id/attributes`         | `categories.edit`                                                 |
| POST   | `/admin/categories/:id/attributes/reorder` | `categories.edit`                                                 |
| PATCH  | `/admin/attributes/:attrId`                | `categories.edit`                                                 |
| DELETE | `/admin/attributes/:attrId`                | `categories.edit`                                                 |
| PUT    | `/admin/attributes/:attrId/options`        | `categories.edit`                                                 |

### Brands

| Method | Path                             | Permission                                    |
| ------ | -------------------------------- | --------------------------------------------- |
| GET    | `/admin/brands`                  | `products.view`                               |
| POST   | `/admin/brands`                  | `products.create`                             |
| PATCH  | `/admin/brands/:id`              | `products.edit`                               |
| DELETE | `/admin/brands/:id[?force=true]` | `products.delete` (409 while products use it) |

### Products and variants

- Up to 2 option types (for example size and colour). Each variant is one combination; a simple product has exactly 1 variant and no options.
- Publishing validates the product. A failed publish returns 400 with a `problems` list.
- Cost prices are returned only to staff with `products.view_cost`.

| Method | Path                            | Permission                                                                           |
| ------ | ------------------------------- | ------------------------------------------------------------------------------------ |
| GET    | `/admin/products`               | `products.view` (filters: status, category, brand, stock, upcoming, preorder; paged) |
| GET    | `/admin/products/:id`           | `products.view`                                                                      |
| POST   | `/admin/products`               | `products.create`                                                                    |
| PATCH  | `/admin/products/:id`           | `products.edit`                                                                      |
| PUT    | `/admin/products/:id/variants`  | `products.edit`                                                                      |
| PUT    | `/admin/products/:id/images`    | `products.edit`                                                                      |
| POST   | `/admin/products/:id/publish`   | `products.publish`                                                                   |
| POST   | `/admin/products/:id/unpublish` | `products.publish`                                                                   |
| POST   | `/admin/products/:id/archive`   | `products.delete`                                                                    |
| POST   | `/admin/products/:id/duplicate` | `products.create`                                                                    |
| DELETE | `/admin/products/:id`           | `products.delete`                                                                    |

### Descriptions (HTML)

Product descriptions (EN and BN) are HTML, sanitized on the server (`sanitize-html`) on every write. Kept: headings, paragraphs, blockquotes, links, images, tables and YouTube iframes. Stripped: scripts, event handlers, `javascript:` and `data:` URLs, non-YouTube iframes, forms and embeds. The same sanitizer is exported for storefront reuse.

### Images

- Upload with `POST /admin/media` (multipart field `file`, optional `alt`). Accepts JPEG, PNG, WebP, AVIF and GIF up to 10 MB. EXIF metadata is stripped.
- Originals are stored in Garage (S3).
- imgproxy resizes on view: `url` is 600 px fit, WebP; `thumbUrl` is 160 px fill.
- `DELETE /admin/media/:id` returns 409 while a product, brand or category still uses the image.

| Method | Path               | Permission                           |
| ------ | ------------------ | ------------------------------------ |
| POST   | `/admin/media`     | `products.edit` or `categories.edit` |
| GET    | `/admin/media/:id` | same as upload                       |
| PATCH  | `/admin/media/:id` | same as upload                       |
| DELETE | `/admin/media/:id` | same as upload                       |

### Inventory

- Stock is a ledger. Every adjustment writes a row, so `GET /admin/inventory/:variantId/movements` shows the history.
- Each variant has on-hand, reserved and available quantities and an optional low-stock threshold.
- `adjust` takes `mode: delta` (add or remove, may be negative) or `mode: set` (set on-hand to a value), plus a required note. Setting stock to its current value still writes a ledger row (stocktake). The ledger is append-only: a database trigger blocks updates and deletes, and products or variants with stock history can only be archived or deactivated. Stock changes that cannot be applied return 409 `Not enough stock`.

| Method | Path                                    | Permission                               |
| ------ | --------------------------------------- | ---------------------------------------- |
| GET    | `/admin/inventory`                      | `inventory.view` (one row per variant)   |
| GET    | `/admin/inventory/low-stock-count`      | `inventory.view`                         |
| GET    | `/admin/inventory/:variantId/movements` | `inventory.view`                         |
| POST   | `/admin/inventory/:variantId/adjust`    | `inventory.adjust`                       |
| PATCH  | `/admin/inventory/:variantId`           | `inventory.adjust` (low-stock threshold) |

### Import / export

Bulk product files, XLSX or CSV (UTF-8 with BOM so Excel keeps Bangla), one row per variant, grouped by `product_slug`. The column list lives in `apps/api/src/catalog/import-export/columns.ts`; the template download has two example rows. Prices are taka in the file (`1,250.50`), paisa in the database. Import is all-or-nothing: `preview` checks the file and lists errors by row and column, `import` writes everything in one transaction. Stock in the file becomes `import` ledger entries; categories and brands must already exist.

| Method | Path                                      | Permission                                                     |
| ------ | ----------------------------------------- | -------------------------------------------------------------- |
| GET    | `/admin/products/export?format=xlsx\|csv` | `products.export` (cost column only with `products.view_cost`) |
| GET    | `/admin/products/import-template`         | `products.import`                                              |
| POST   | `/admin/products/import/preview`          | `products.import`                                              |
| POST   | `/admin/products/import`                  | `products.import`                                              |

## Admin app

`apps/admin`: Vite + React 19 + Mantine 9, TanStack Router (file routes in `src/routes`) + TanStack Query, typed calls through `@bdc/api-client`. `pnpm --filter @bdc/admin dev` serves http://localhost:5173 and proxies `/v1` to the API (`API_URL`, default `http://localhost:4000`) so the session cookie is same-origin. Pages: login + 2FA setup/verify, settings, staff, roles, catalog (categories + attributes, brands, products + variants, inventory, import/export). Navigation hides what the signed-in staff lacks permission for.

## Permissions

Defined in `apps/api/src/auth/permissions.ts` and synced to the database at startup. The Owner role has all of them.
- **Staff:** `staff.view`, `staff.manage`, `roles.manage`
- **Settings:** `settings.view`, `settings.manage`
- **Products:** `products.view`, `products.create`, `products.edit`, `products.delete`, `products.publish`, `products.edit_price`, `products.view_cost`, `products.export`, `products.import`
- **Categories:** `categories.view`, `categories.create`, `categories.edit`, `categories.delete`, `categories.set_home`, `categories.delete_with_products`
- **Inventory:** `inventory.view`, `inventory.adjust`, `inventory.export`

## Packages

- `@bdc/api-client`: typed API client (`createApiClient({ baseUrl })`).
- `@bdc/i18n`: EN/BN helpers: `formatPrice(paisa, lang)`, `formatNumber`, `toBnDigits`, `toEnDigits`, `pickText`. BN uses Bangla digits including prices (Q104), lakh grouping; never use them on order IDs, phones or tracking IDs.

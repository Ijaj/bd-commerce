import { Prisma } from '../generated/prisma/client';

const { sql } = Prisma;

/**
 * SQL twin of pricing.ts#effectivePrice. A sale counts only inside its window and when cheaper.
 * Columns come from the `v` (variants) alias.
 */
const SALE_ACTIVE = sql`(v.sale_price_p IS NOT NULL AND v.sale_price_p < v.price_p
  AND (v.sale_starts_at IS NULL OR v.sale_starts_at <= now())
  AND (v.sale_ends_at IS NULL OR v.sale_ends_at > now()))`;

/**
 * Per product, the cheapest live flash price (window open, sale active, stock left) with the
 * regular strike-through for that variant. Not correlated: the live set is tiny, so it is built
 * once per query and hash-joined. A per-variant lookup inside the price lateral made list queries
 * 2x slower at 20k products even with no flash sale at all.
 */
const FLASH_BY_PRODUCT = sql`(
  SELECT DISTINCT ON (fv.product_id) fv.product_id, fi.flash_price_p AS fp,
    GREATEST(coalesce(fv.compare_at_p, 0), fv.price_p) AS compare
  FROM flash_sale_items fi
  JOIN flash_sales fs ON fs.id = fi.flash_sale_id
  JOIN variants fv ON fv.id = fi.variant_id AND fv.is_active
  WHERE fi.qty_sold < fi.qty_limit AND fs.is_active AND fs.starts_at <= now() AND fs.ends_at > now()
  ORDER BY fv.product_id, fi.flash_price_p, fv.sort, fv.id
)`;

/**
 * Public products with the cheapest active variant (`cv.price`, `cv.compare`) and total sellable
 * stock (`st.stock`). Price = lowest of base, live sale and live flash, same as effectivePrice()
 * (on an exact tie between variants the regular price wins). Products without an active variant
 * drop out of the lateral join.
 * Aliases: p products, pc primary category, b brand (active brands only).
 */
export const PRODUCT_FROM = sql`
  FROM products p
  JOIN categories pc ON pc.id = p.primary_category_id
  LEFT JOIN brands b ON b.id = p.brand_id AND b.active
  CROSS JOIN LATERAL (
    SELECT
      CASE WHEN ${SALE_ACTIVE} THEN v.sale_price_p ELSE v.price_p END AS price,
      CASE WHEN ${SALE_ACTIVE} THEN GREATEST(coalesce(v.compare_at_p, 0), v.price_p)
           WHEN v.compare_at_p > v.price_p THEN v.compare_at_p END AS compare
    FROM variants v
    WHERE v.product_id = p.id AND v.is_active
    ORDER BY 1, v.sort, v.id
    LIMIT 1
  ) cv0
  LEFT JOIN ${FLASH_BY_PRODUCT} fl ON fl.product_id = p.id
  CROSS JOIN LATERAL (
    SELECT
      CASE WHEN fl.fp < cv0.price THEN fl.fp ELSE cv0.price END AS price,
      CASE WHEN fl.fp < cv0.price THEN fl.compare ELSE cv0.compare END AS compare
  ) cv
  CROSS JOIN LATERAL (
    SELECT coalesce(sum(greatest(i.on_hand - i.reserved, 0)), 0)::int AS stock
    FROM variants v
    LEFT JOIN inventory i ON i.variant_id = v.id
    WHERE v.product_id = p.id AND v.is_active
  ) st`;

/** Visibility rule for every public query (status, publish time, whole category chain active). */
export const PUBLIC_WHERE = sql`
  p.status = 'active' AND p.published_at IS NOT NULL AND p.published_at <= now()
  AND pc.is_active
  AND NOT EXISTS (SELECT 1 FROM categories ic WHERE NOT ic.is_active AND starts_with(pc.path, ic.path))`;

/** Same expression as the GIN index created by the storefront_search migration. */
export function searchVector(alias: string) {
  const col = (name: string) => Prisma.raw(`${alias}.${name}`);
  return sql`to_tsvector('english', ${col('title_en')} || ' ' || coalesce(${col('short_description_en')}, ''))`;
}

/**
 * Ids matching a search: full-text, or trigram on the title or the brand name (typos, brand
 * searches). One indexable branch each, so a big catalog doesn't fall back to a scan.
 */
export function searchMatches(q: string) {
  return sql`
    SELECT s1.id FROM products s1
      WHERE ${searchVector('s1')} @@ websearch_to_tsquery('english', ${q})
    UNION
    SELECT s2.id FROM products s2 WHERE ${q} <% s2.title_en
    UNION
    SELECT s3.id FROM products s3 JOIN brands sb ON sb.id = s3.brand_id WHERE ${q} <% sb.name_en`;
}

/** Unavailable-but-buyable-later products are not "out of stock" (Q114). */
export const IN_STOCK = sql`(st.stock > 0 AND NOT p.is_preorder AND NOT p.is_upcoming)`;

export function where(conds: Prisma.Sql[]) {
  return conds.length ? sql`WHERE ${Prisma.join(conds, ' AND ')}` : Prisma.empty;
}

export { sql };

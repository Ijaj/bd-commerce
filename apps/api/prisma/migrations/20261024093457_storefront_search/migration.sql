-- Search (S-T4, Q30: English only at launch). Expression indexes, not columns, so Prisma sees no drift.
-- Queries must use the exact same expression to hit the index:
--   to_tsvector('english', title_en || ' ' || coalesce(short_description_en, ''))
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX "products_search_idx" ON "products"
  USING GIN (to_tsvector('english', "title_en" || ' ' || coalesce("short_description_en", '')));
-- Autocomplete / typo tolerance: `title_en % $q` or `title_en ILIKE '%q%'`.
CREATE INDEX "products_title_trgm_idx" ON "products" USING GIN ("title_en" gin_trgm_ops);
CREATE INDEX "brands_name_trgm_idx" ON "brands" USING GIN ("name_en" gin_trgm_ops);

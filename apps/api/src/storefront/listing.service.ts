import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ImageService } from './images';
import { ProductCardService } from './product-card.service';
import type { ListingResult, Sort } from './public.dto';
import { PublicCategoriesService, type PublicCategory } from './public-categories.service';
import {
  IN_STOCK,
  PRODUCT_FROM,
  PUBLIC_WHERE,
  searchMatches,
  searchVector,
  sql,
  where,
} from './sql';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const AVAILABILITY = ['in_stock', 'preorder', 'upcoming'] as const;
type Availability = (typeof AVAILABILITY)[number];
type Db = Prisma.TransactionClient | PrismaService;

export interface ListParams {
  category?: string;
  q?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  rating?: number;
  availability?: string;
  sort?: Sort;
  page: number;
  limit: number;
  /** Raw `attr.<key>` query values. */
  attrs: Record<string, string>;
}

interface Filters {
  categoryPath: string | null;
  q: string | null;
  brands: string[];
  minPrice?: number;
  maxPrice?: number;
  rating?: number;
  availability: Availability[];
  /** attribute key → option ids (uuid) and/or 'true' */
  attrs: Map<string, string[]>;
}

/** Which filter a facet must ignore so the facet shows what the customer could switch to. */
type Skip = { kind: 'brand' | 'price' | 'availability' } | { kind: 'attr'; key: string } | null;

function csv(raw: string | undefined, max = 30) {
  return (raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, max);
}

@Injectable()
export class ListingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly categories: PublicCategoriesService,
    private readonly cards: ProductCardService,
    private readonly images: ImageService,
  ) {}

  async list(params: ListParams): Promise<ListingResult> {
    const tree = await this.categories.tree();
    let category: PublicCategory | null = null;
    if (params.category) {
      category = tree.bySlug.get(params.category) ?? null;
      if (!category) throw new NotFoundException('Category not found');
    }

    const filters: Filters = {
      categoryPath: category?.path ?? null,
      q: params.q && params.q.length > 0 ? params.q : null,
      brands: csv(params.brand),
      minPrice: params.minPrice,
      maxPrice: params.maxPrice,
      rating: params.rating,
      availability: csv(params.availability).filter((a): a is Availability =>
        (AVAILABILITY as readonly string[]).includes(a),
      ),
      attrs: new Map(),
    };
    for (const [key, raw] of Object.entries(params.attrs)) {
      const values = csv(raw).filter((v) => v === 'true' || UUID.test(v));
      if (values.length) filters.attrs.set(key, values);
    }

    const sort: Sort = params.sort ?? (filters.q ? 'relevance' : 'popular');
    const attributes = category ? await this.attributeDefs(category.path) : [];
    const attrIdsByKey = new Map<string, string[]>();
    for (const a of attributes) attrIdsByKey.set(a.key, [...(attrIdsByKey.get(a.key) ?? []), a.id]);

    const offset = (params.page - 1) * params.limit;
    const [pageRows, totalRows, brandRows, priceRows, availRows, attrFacets] = await this.run(
      filters.q !== null,
      (db) =>
        Promise.all([
          db.$queryRaw<{ id: string }[]>`
        SELECT p.id ${PRODUCT_FROM}
        ${this.whereSql(filters, null, attrIdsByKey)}
        ORDER BY ${this.orderBy(sort, filters.q)}
        LIMIT ${params.limit} OFFSET ${offset}`,
          db.$queryRaw<{ n: number }[]>`
        SELECT count(*)::int AS n ${PRODUCT_FROM} ${this.whereSql(filters, null, attrIdsByKey)}`,
          db.$queryRaw<{ slug: string; name_en: string; name_bn: string | null; count: number }[]>`
        SELECT b.slug, b.name_en, b.name_bn, count(*)::int AS count ${PRODUCT_FROM}
        ${this.whereSql(filters, { kind: 'brand' }, attrIdsByKey, sql`b.id IS NOT NULL`)}
        GROUP BY b.id ORDER BY count DESC, b.name_en`,
          db.$queryRaw<{ min: number | null; max: number | null }[]>`
        SELECT min(cv.price)::int AS min, max(cv.price)::int AS max ${PRODUCT_FROM}
        ${this.whereSql(filters, { kind: 'price' }, attrIdsByKey)}`,
          db.$queryRaw<{ in_stock: number; preorder: number; upcoming: number }[]>`
        SELECT count(*) FILTER (WHERE ${IN_STOCK})::int AS in_stock,
               count(*) FILTER (WHERE p.is_preorder)::int AS preorder,
               count(*) FILTER (WHERE p.is_upcoming)::int AS upcoming
        ${PRODUCT_FROM} ${this.whereSql(filters, { kind: 'availability' }, attrIdsByKey)}`,
          this.attributeFacets(db, filters, attributes, attrIdsByKey),
        ]),
    );

    const items = await this.cards.cards(pageRows.map((r) => r.id));
    const price = priceRows[0];
    const avail = availRows[0];
    return {
      items,
      total: totalRows[0]?.n ?? 0,
      page: params.page,
      limit: params.limit,
      facets: {
        brands: brandRows.map((b) => ({
          slug: b.slug,
          nameEn: b.name_en,
          nameBn: b.name_bn,
          count: b.count,
        })),
        price:
          price && price.min !== null && price.max !== null
            ? { min: price.min, max: price.max }
            : null,
        availability: {
          in_stock: avail?.in_stock ?? 0,
          preorder: avail?.preorder ?? 0,
          upcoming: avail?.upcoming ?? 0,
        },
        attributes: attrFacets,
      },
      category: category
        ? {
            id: category.id,
            slug: category.slug,
            nameEn: category.nameEn,
            nameBn: category.nameBn,
            descriptionEn: category.descriptionEn,
            descriptionBn: category.descriptionBn,
            seoTitle: category.seoTitle,
            seoDescription: category.seoDescription,
            banner: this.images.setOrNull(category.banner, category.nameEn),
            breadcrumb: this.categories.breadcrumb(tree, category.path),
            children: category.node.children,
          }
        : null,
    };
  }

  /**
   * Searches run in a transaction with a lower trigram threshold: the default 0.6 misses ordinary
   * typos like "samsng". Queries without a search term stay on the pool, in parallel.
   */
  private run<T>(search: boolean, fn: (db: Db) => Promise<T>): Promise<T> {
    if (!search) return fn(this.prisma);
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('pg_trgm.word_similarity_threshold', '0.4', true)`;
      return fn(tx);
    });
  }

  private orderBy(sort: Sort, q: string | null): Prisma.Sql {
    switch (sort) {
      case 'relevance':
        if (q) return sql`${this.relevance(q)} DESC, p.sold_count DESC, p.id`;
        return sql`p.sold_count DESC, p.view_count DESC, p.id`;
      case 'newest':
        return sql`p.published_at DESC, p.id`;
      case 'price_asc':
        return sql`cv.price ASC, p.id`;
      case 'price_desc':
        return sql`cv.price DESC, p.id`;
      case 'rating':
        return sql`p.rating_avg DESC, p.rating_count DESC, p.id`;
      default:
        return sql`p.sold_count DESC, p.view_count DESC, p.id`;
    }
  }

  /** Full-text rank first, trigram similarity on title and brand to survive typos. */
  private relevance(q: string) {
    return sql`(
      ts_rank(${searchVector('p')}, websearch_to_tsquery('english', ${q})) * 2
      + word_similarity(${q}, p.title_en)
      + coalesce(word_similarity(${q}, b.name_en), 0) * 0.5)`;
  }

  private whereSql(
    f: Filters,
    skip: Skip,
    attrIdsByKey: Map<string, string[]>,
    ...extra: Prisma.Sql[]
  ) {
    const conds: Prisma.Sql[] = [PUBLIC_WHERE, ...extra];
    if (f.categoryPath) {
      conds.push(sql`(starts_with(pc.path, ${f.categoryPath}) OR EXISTS (
        SELECT 1 FROM product_categories xc JOIN categories c2 ON c2.id = xc.category_id
        WHERE xc.product_id = p.id AND starts_with(c2.path, ${f.categoryPath})))`);
    }
    if (f.q) {
      const q = f.q;
      conds.push(sql`p.id IN (${searchMatches(q)})`);
    }
    if (f.brands.length && skip?.kind !== 'brand') {
      conds.push(sql`b.slug = ANY(${f.brands}::text[])`);
    }
    if (skip?.kind !== 'price') {
      if (f.minPrice !== undefined) conds.push(sql`cv.price >= ${f.minPrice}`);
      if (f.maxPrice !== undefined) conds.push(sql`cv.price <= ${f.maxPrice}`);
    }
    if (f.rating !== undefined) conds.push(sql`p.rating_avg >= ${f.rating}`);
    if (f.availability.length && skip?.kind !== 'availability') {
      const parts = f.availability.map((a) =>
        a === 'in_stock' ? IN_STOCK : a === 'preorder' ? sql`p.is_preorder` : sql`p.is_upcoming`,
      );
      conds.push(sql`(${Prisma.join(parts, ' OR ')})`);
    }
    for (const [key, values] of f.attrs) {
      if (skip?.kind === 'attr' && skip.key === key) continue;
      const optionIds = values.filter((v) => v !== 'true');
      const boolAttrIds = values.includes('true') ? (attrIdsByKey.get(key) ?? []) : [];
      if (optionIds.length === 0 && boolAttrIds.length === 0) continue;
      conds.push(sql`EXISTS (
        SELECT 1 FROM product_attribute_values x WHERE x.product_id = p.id AND (
          x.option_id = ANY(${optionIds}::uuid[])
          OR (x.value_bool IS TRUE AND x.attribute_id = ANY(${boolAttrIds}::uuid[]))))`);
    }
    return where(conds);
  }

  /** Filterable attributes of the category and its ancestors, ancestors first. */
  private async attributeDefs(path: string) {
    const ids = path.split('/').filter(Boolean);
    const rows = await this.prisma.categoryAttribute.findMany({
      where: {
        categoryId: { in: ids },
        isFilterable: true,
        type: { in: ['select', 'multiselect', 'boolean'] },
      },
      include: { options: { orderBy: [{ sort: 'asc' }, { valueEn: 'asc' }] } },
    });
    const depth = new Map(ids.map((id, i) => [id, i]));
    return rows.sort(
      (a, b) =>
        (depth.get(a.categoryId) ?? 0) - (depth.get(b.categoryId) ?? 0) ||
        a.sort - b.sort ||
        a.key.localeCompare(b.key),
    );
  }

  private async attributeFacets(
    db: Db,
    f: Filters,
    attributes: Awaited<ReturnType<ListingService['attributeDefs']>>,
    attrIdsByKey: Map<string, string[]>,
  ): Promise<ListingResult['facets']['attributes']> {
    if (attributes.length === 0) return [];
    // One count query for attributes without an active filter, one more per filtered key.
    const keys = [...new Set(attributes.map((a) => a.key))];
    const counts = new Map<string, number>(); // option id → count; boolean: `bool:<attributeId>`
    const run = async (skip: Skip, attributeIds: string[]) => {
      const rows = await db.$queryRaw<
        { option_id: string | null; attribute_id: string; count: number }[]
      >`
        SELECT pav.option_id, pav.attribute_id, count(DISTINCT p.id)::int AS count
        ${PRODUCT_FROM}
        JOIN product_attribute_values pav ON pav.product_id = p.id
        ${this.whereSql(
          f,
          skip,
          attrIdsByKey,
          sql`pav.attribute_id = ANY(${attributeIds}::uuid[])`,
          sql`(pav.option_id IS NOT NULL OR pav.value_bool IS TRUE)`,
        )}
        GROUP BY pav.option_id, pav.attribute_id`;
      for (const r of rows) counts.set(r.option_id ?? `bool:${r.attribute_id}`, r.count);
    };
    const filteredKeys = keys.filter((k) => f.attrs.has(k));
    const free = attributes.filter((a) => !f.attrs.has(a.key)).map((a) => a.id);
    await Promise.all([
      free.length ? run(null, free) : Promise.resolve(),
      ...filteredKeys.map((key) => run({ kind: 'attr', key }, attrIdsByKey.get(key) ?? [])),
    ]);

    const out: ListingResult['facets']['attributes'] = [];
    const seen = new Set<string>();
    for (const a of attributes) {
      if (seen.has(a.key)) continue; // same key on a parent and child: one facet, outermost wins
      seen.add(a.key);
      const picked = f.attrs.get(a.key) ?? [];
      const options =
        a.type === 'boolean'
          ? [
              {
                id: 'true',
                valueEn: 'Yes',
                valueBn: 'হ্যাঁ',
                count: counts.get(`bool:${a.id}`) ?? 0,
              },
            ]
          : a.options.map((o) => ({
              id: o.id,
              valueEn: o.valueEn,
              valueBn: o.valueBn,
              count: counts.get(o.id) ?? 0,
            }));
      const shown = options.filter((o) => o.count > 0 || picked.includes(o.id));
      if (shown.length === 0) continue;
      out.push({
        key: a.key,
        nameEn: a.nameEn,
        nameBn: a.nameBn,
        type: a.type,
        unit: a.unit,
        options: shown,
      });
    }
    return out;
  }
}

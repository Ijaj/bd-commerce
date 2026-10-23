import { BadRequestException, Injectable } from '@nestjs/common';
import type { PermissionKey } from '../../auth/permissions';
import type { StaffAuthContext } from '../../auth/staff-auth.service';
import { Prisma } from '../../generated/prisma/client';
import { InventoryService } from '../../inventory/inventory.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CategoriesService } from '../categories/categories.service';
import { sanitizeDescriptionHtml } from '../html/sanitize';
import type { VariantsPayload } from '../products/products.dto';
import { rethrowUnique, slugSchemaPattern } from '../products/slug';
import { VariantsService } from '../products/variants.service';
import { isYoutubeUrl } from '../products/youtube';
import { ATTR_PREFIX, COLUMN_NAMES, COST_COLUMN, MAX_IMPORT_ROWS } from './columns';
import { readSheet } from './file-io';
import type { ImportIssue } from './import-export.dto';
import { parseBool, parseDate, parseDecimal, parseInteger, parsePrice, splitList } from './parse';

export type ImportMode = 'upsert' | 'create_only';
type Perms = Set<PermissionKey>;
type Tx = Prisma.TransactionClient;
type Kind = 'create' | 'update' | 'unchanged';

const existingInclude = {
  categories: true,
  attributeValues: true,
  options: { include: { values: { orderBy: { sort: 'asc' } } }, orderBy: { position: 'asc' } },
  variants: { include: { inventory: true }, orderBy: { sort: 'asc' } },
} satisfies Prisma.ProductInclude;
type Existing = Prisma.ProductGetPayload<{ include: typeof existingInclude }>;
type ExistingVariant = Existing['variants'][number];

interface Row {
  row: number;
  v: Record<string, string>;
}

interface VariantPlan {
  sku: string;
  kind: Kind;
  /** Desired on-hand (undefined = leave stock alone). */
  onHand?: number;
  stockDelta: number;
}

interface ProductPlan {
  slug: string;
  kind: Kind;
  existing?: Existing;
  /** Scalar columns to write (all of them on create, only changed ones on update). */
  data: Record<string, unknown>;
  statusAfter: 'draft' | 'active' | 'archived';
  categoryIds: string[];
  catsDirty: boolean;
  attrDeleteIds: string[];
  attrRows: Prisma.ProductAttributeValueCreateManyInput[];
  attrsDirty: boolean;
  payload: VariantsPayload;
  callApply: boolean;
  variants: VariantPlan[];
}

export interface ImportPlan {
  rows: number;
  products: ProductPlan[];
  errors: ImportIssue[];
  warnings: ImportIssue[];
}

export interface ImportResult {
  rows: number;
  products: Record<Kind, number>;
  variants: Record<Kind, number>;
  stockMovements: number;
  errors: ImportIssue[];
  errorCount: number;
  warnings: ImportIssue[];
}

const norm = (s: string) => s.trim().toLowerCase();
const MAX_ERRORS_RETURNED = 500;

/** Equality for scalar column values (dates compare as YYYY-MM-DD). */
function same(a: unknown, b: unknown): boolean {
  const n = (x: unknown) => (x instanceof Date ? x.toISOString().slice(0, 10) : (x ?? null));
  return n(a) === n(b);
}

@Injectable()
export class ImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly categories: CategoriesService,
    private readonly variants: VariantsService,
    private readonly inventory: InventoryService,
  ) {}

  // ---- public API ------------------------------------------------------------------------------

  async preview(buf: Buffer, mode: ImportMode, perms: Perms): Promise<ImportResult> {
    return this.summarize(await this.plan(buf, mode, perms));
  }

  /**
   * Validates everything first (nothing written on any error), then applies the whole file in ONE
   * transaction. A single transaction keeps the all-or-nothing promise; the row cap (5000) bounds
   * its length, and the timeout is raised well above Prisma's 5 s default.
   */
  async run(actor: StaffAuthContext, buf: Buffer, mode: ImportMode): Promise<ImportResult> {
    const plan = await this.plan(buf, mode, actor.permissions);
    const result = this.summarize(plan);
    if (plan.errors.length) {
      throw new BadRequestException({
        statusCode: 400,
        message: `Import has ${plan.errors.length} error(s); nothing was written`,
        errors: result.errors,
        errorCount: result.errorCount,
      });
    }
    await this.prisma
      .$transaction(
        async (tx) => {
          for (const p of plan.products) {
            if (p.kind !== 'unchanged') await this.apply(tx, actor, p);
          }
        },
        { timeout: 300_000, maxWait: 30_000 },
      )
      .catch((e) => rethrowUnique(e, 'A slug or SKU was taken meanwhile; run the preview again'));
    return result;
  }

  private summarize(plan: ImportPlan): ImportResult {
    const products = { create: 0, update: 0, unchanged: 0 };
    const variants = { create: 0, update: 0, unchanged: 0 };
    let stockMovements = 0;
    for (const p of plan.products) {
      products[p.kind]++;
      for (const v of p.variants) {
        variants[v.kind]++;
        if (v.stockDelta !== 0) stockMovements++;
      }
    }
    return {
      rows: plan.rows,
      products,
      variants,
      stockMovements,
      errors: plan.errors.slice(0, MAX_ERRORS_RETURNED),
      errorCount: plan.errors.length,
      warnings: plan.warnings.slice(0, MAX_ERRORS_RETURNED),
    };
  }

  // ---- planning (parse + validate, no writes) ------------------------------------------------

  async plan(buf: Buffer, mode: ImportMode, perms: Perms): Promise<ImportPlan> {
    const sheet = await readSheet(buf);
    const errors: ImportIssue[] = [];
    const warnings: ImportIssue[] = [];
    const err = (row: number, column: string, message: string) =>
      errors.push({ row, column, message });
    const out: ImportPlan = { rows: sheet.rows.length, products: [], errors, warnings };
    if (sheet.rows.length > MAX_IMPORT_ROWS) {
      throw new BadRequestException(`At most ${MAX_IMPORT_ROWS} rows per import`);
    }

    // ---- header ----------------------------------------------------------------------------
    const known = new Set(COLUMN_NAMES);
    const seenHeaders = new Set<string>();
    const attrCols: string[] = [];
    for (const h of sheet.headers) {
      if (!h) continue;
      if (seenHeaders.has(h)) err(1, h, 'Column appears twice');
      seenHeaders.add(h);
      if (h.startsWith(ATTR_PREFIX)) {
        if (h.length > ATTR_PREFIX.length) attrCols.push(h);
        else err(1, h, 'Attribute columns look like attr:<key>');
      } else if (!known.has(h)) {
        warnings.push({ row: 1, column: h, message: 'Unknown column ignored' });
      }
    }
    const has = (name: string) => seenHeaders.has(name);
    for (const must of ['product_slug', 'sku']) {
      if (!has(must)) err(1, must, `Column ${must} is required`);
    }
    for (const i of [1, 2]) {
      const anyOf = has(`option${i}_name_en`) || has(`option${i}_value_en`);
      if (anyOf && !(has(`option${i}_name_en`) && has(`option${i}_value_en`))) {
        err(
          1,
          `option${i}_name_en`,
          `Option ${i} needs both option${i}_name_en and option${i}_value_en columns`,
        );
      }
    }
    if (has('option2_name_en') && !has('option1_name_en')) {
      err(1, 'option2_name_en', 'Option 2 needs option 1 columns');
    }
    if (errors.length) return out;

    const rows: Row[] = sheet.rows.map((r) => {
      const v: Record<string, string> = {};
      sheet.headers.forEach((h, i) => {
        if (h) v[h] = r.cells[i] ?? '';
      });
      return { row: r.row, v };
    });

    // ---- group rows per product ------------------------------------------------------------
    const groups = new Map<string, Row[]>();
    for (const r of rows) {
      const slug = norm(r.v.product_slug ?? '');
      if (!slug) {
        err(r.row, 'product_slug', 'Required');
        continue;
      }
      if (!slugSchemaPattern.test(slug) || slug.length > 120) {
        err(r.row, 'product_slug', 'Use lowercase letters, digits and single dashes');
        continue;
      }
      const g = groups.get(slug);
      if (g) g.push(r);
      else groups.set(slug, [r]);
    }

    // ---- reference data ----------------------------------------------------------------------
    const slugs = [...groups.keys()];
    const skuSeen = new Map<string, number>();
    for (const r of rows) {
      const sku = r.v.sku ?? '';
      if (!sku) {
        err(r.row, 'sku', 'Required');
        continue;
      }
      if (sku.length > 64 || sku.startsWith('~')) {
        err(r.row, 'sku', 'SKU must be at most 64 characters and must not start with ~');
      }
      const first = skuSeen.get(sku);
      if (first !== undefined) err(r.row, 'sku', `Duplicate SKU (also on row ${first})`);
      else skuSeen.set(sku, r.row);
    }
    const existingProducts = await this.findByChunks(slugs, (chunk) =>
      this.prisma.product.findMany({ where: { slug: { in: chunk } }, include: existingInclude }),
    );
    const existingBySlug = new Map(existingProducts.map((p) => [p.slug, p]));
    const skuOwners = new Map(
      (
        await this.findByChunks([...skuSeen.keys()], (chunk) =>
          this.prisma.variant.findMany({
            where: { sku: { in: chunk } },
            select: { sku: true, productId: true },
          }),
        )
      ).map((v) => [v.sku, v.productId]),
    );

    const wantedCatSlugs = new Set<string>();
    const wantedBrandSlugs = new Set<string>();
    for (const r of rows) {
      for (const s of [r.v.primary_category_slug ?? '', ...splitList(r.v.category_slugs ?? '')]) {
        if (s) wantedCatSlugs.add(norm(s));
      }
      if (r.v.brand_slug) wantedBrandSlugs.add(norm(r.v.brand_slug));
    }
    const catBySlug = new Map(
      (
        await this.findByChunks([...wantedCatSlugs], (chunk) =>
          this.prisma.category.findMany({
            where: { slug: { in: chunk } },
            select: { id: true, slug: true, isActive: true },
          }),
        )
      ).map((c) => [c.slug, c]),
    );
    const brandBySlug = new Map(
      (
        await this.findByChunks([...wantedBrandSlugs], (chunk) =>
          this.prisma.brand.findMany({
            where: { slug: { in: chunk } },
            select: { id: true, slug: true },
          }),
        )
      ).map((b) => [b.slug, b.id]),
    );
    const defsCache = new Map<
      string,
      Awaited<ReturnType<CategoriesService['inheritedAttributes']>>
    >();
    const defsFor = async (ids: string[]) => {
      const key = [...ids].sort().join(',');
      let d = defsCache.get(key);
      if (!d) {
        d = await this.categories.inheritedAttributes(ids);
        defsCache.set(key, d);
      }
      return d;
    };

    // ---- per product -------------------------------------------------------------------------
    for (const [slug, group] of groups) {
      const first = group[0] as Row;
      const existing = existingBySlug.get(slug);
      const e = (row: number, column: string, message: string) => err(row, column, message);

      if (existing && mode === 'create_only') {
        e(first.row, 'product_slug', 'Product already exists (mode create_only)');
        continue;
      }
      for (const r of group) {
        const owner = skuOwners.get(r.v.sku ?? '');
        if (owner && owner !== existing?.id) {
          e(r.row, 'sku', 'SKU already belongs to another product');
        }
      }

      /** First non-blank value across the product's rows; differing non-blank values are errors. */
      const pv = (name: string) => {
        let found: { value: string; row: number } | undefined;
        for (const r of group) {
          const v = r.v[name] ?? '';
          if (!v) continue;
          if (!found) found = { value: v, row: r.row };
          else if (v !== found.value) {
            e(
              r.row,
              name,
              `Differs from row ${found.row}; product columns must match on every row`,
            );
          }
        }
        return found ?? { value: '', row: first.row };
      };
      const needOnCreate = (name: string, filled: boolean) => {
        if (!existing && !filled) e(first.row, name, 'Required to create a product');
      };

      // ---- product scalars
      const data: Record<string, unknown> = {};
      const textField = (name: string, key: string, max: number, required = false) => {
        if (!has(name)) return needOnCreate(name, !required);
        const { value, row } = pv(name);
        if (value.length > max) e(row, name, `At most ${max} characters`);
        if (required) {
          needOnCreate(name, !!value);
          if (value) data[key] = value;
        } else {
          data[key] = value || null;
        }
      };
      textField('title_en', 'titleEn', 250, true);
      textField('title_bn', 'titleBn', 250);
      textField('short_description_en', 'shortDescriptionEn', 1000);
      textField('short_description_bn', 'shortDescriptionBn', 1000);
      for (const [name, key] of [
        ['description_html_en', 'descriptionHtmlEn'],
        ['description_html_bn', 'descriptionHtmlBn'],
      ] as const) {
        if (!has(name)) continue;
        const { value, row } = pv(name);
        if (value.length > 200_000) e(row, name, 'At most 200000 characters');
        data[key] = value ? sanitizeDescriptionHtml(value) || null : null;
      }
      if (has('youtube_url')) {
        const { value, row } = pv('youtube_url');
        if (value && !isYoutubeUrl(value)) e(row, 'youtube_url', 'Not a YouTube link');
        data.youtubeUrl = value || null;
      }
      if (has('weight_g')) {
        const { value, row } = pv('weight_g');
        if (value) {
          const p = parseInteger(value);
          if (p.ok) data.weightG = p.value;
          else e(row, 'weight_g', p.error);
        } else data.weightG = null;
      }
      for (const [name, key] of [
        ['is_preorder', 'isPreorder'],
        ['is_upcoming', 'isUpcoming'],
      ] as const) {
        if (!has(name)) continue;
        const { value, row } = pv(name);
        if (value) {
          const p = parseBool(value);
          if (p.ok) data[key] = p.value;
          else e(row, name, p.error);
        } else if (!existing) data[key] = false;
      }
      if (has('preorder_expected_date')) {
        const { value, row } = pv('preorder_expected_date');
        if (value) {
          const p = parseDate(value);
          if (p.ok) data.preorderExpectedDate = p.value;
          else e(row, 'preorder_expected_date', p.error);
        } else data.preorderExpectedDate = null;
      }
      if (has('fulfillment')) {
        const { value, row } = pv('fulfillment');
        const f = norm(value);
        if (f === 'stock' || f === 'dropship') data.fulfillment = f;
        else if (f) e(row, 'fulfillment', 'Must be stock or dropship');
        else if (!existing) data.fulfillment = 'stock';
      }
      let statusAfter: ProductPlan['statusAfter'] = existing?.status ?? 'draft';
      if (has('status')) {
        const { value, row } = pv('status');
        const s = norm(value);
        if (s === 'draft' || s === 'active' || s === 'archived') {
          statusAfter = s;
        } else if (s) e(row, 'status', 'Must be draft, active or archived');
      }
      if (has('brand_slug')) {
        const { value, row } = pv('brand_slug');
        if (!value) data.brandId = null;
        else {
          const id = brandBySlug.get(norm(value));
          if (id) data.brandId = id;
          else e(row, 'brand_slug', `Unknown brand "${value}"`);
        }
      }

      // ---- categories
      let primaryId = existing?.primaryCategoryId;
      let primaryActive = true;
      if (has('primary_category_slug')) {
        const { value, row } = pv('primary_category_slug');
        needOnCreate('primary_category_slug', !!value);
        if (value) {
          const c = catBySlug.get(norm(value));
          if (c) {
            primaryId = c.id;
            primaryActive = c.isActive;
          } else e(row, 'primary_category_slug', `Unknown category "${value}"`);
        }
      } else needOnCreate('primary_category_slug', false);
      if (existing && primaryId === existing.primaryCategoryId && !has('primary_category_slug')) {
        primaryActive =
          (
            await this.prisma.category.findUnique({
              where: { id: existing.primaryCategoryId },
              select: { isActive: true },
            })
          )?.isActive ?? true;
      }
      let extraIds = existing?.categories.map((c) => c.categoryId) ?? [];
      if (has('category_slugs')) {
        const { value, row } = pv('category_slugs');
        extraIds = [];
        for (const s of splitList(value)) {
          const c = catBySlug.get(norm(s));
          if (c) extraIds.push(c.id);
          else e(row, 'category_slugs', `Unknown category "${s}"`);
        }
      }
      const categoryIds = primaryId ? [...new Set([primaryId, ...extraIds])] : [];
      if (primaryId) data.primaryCategoryId = primaryId;
      const catsDirty =
        !existing ||
        categoryIds.length !== existing.categories.length ||
        categoryIds.some((id) => !existing.categories.some((c) => c.categoryId === id));

      // ---- attributes
      const defs = categoryIds.length ? await defsFor(categoryIds) : [];
      const defByKey = new Map<string, (typeof defs)[number]>();
      for (const d of defs) if (!defByKey.has(norm(d.key))) defByKey.set(norm(d.key), d);
      const desiredSig = new Map<string, string>();
      const attrRows: Prisma.ProductAttributeValueCreateManyInput[] = [];
      const presentIds = new Set<string>();
      for (const col of attrCols) {
        const key = col.slice(ATTR_PREFIX.length);
        const { value, row } = pv(col);
        const def = defByKey.get(norm(key));
        if (!def) {
          if (value) e(row, col, `No attribute "${key}" applies to this product's categories`);
          continue;
        }
        presentIds.add(def.id);
        if (!value) continue;
        const base = { productId: '', attributeId: def.id };
        switch (def.type) {
          case 'text':
            if (value.length > 1000) e(row, col, 'At most 1000 characters');
            attrRows.push({ ...base, valueText: value });
            desiredSig.set(def.id, value);
            break;
          case 'number': {
            const p = parseDecimal(value);
            if (!p.ok) e(row, col, p.error);
            else {
              attrRows.push({ ...base, valueNumber: p.value });
              desiredSig.set(def.id, p.value);
            }
            break;
          }
          case 'boolean': {
            const p = parseBool(value);
            if (!p.ok) e(row, col, p.error);
            else {
              attrRows.push({ ...base, valueBool: p.value });
              desiredSig.set(def.id, String(p.value));
            }
            break;
          }
          default: {
            const wanted = def.type === 'select' ? [value] : splitList(value);
            if (def.type === 'select' && value.includes('|')) {
              e(row, col, `"${def.nameEn}" takes exactly one value`);
              break;
            }
            const ids: string[] = [];
            for (const w of wanted) {
              const o = def.options.find((x) => norm(x.valueEn) === norm(w));
              if (!o) e(row, col, `"${w}" is not an option of "${def.nameEn}"`);
              else if (!ids.includes(o.id)) ids.push(o.id);
            }
            for (const optionId of ids) attrRows.push({ ...base, optionId });
            desiredSig.set(def.id, [...ids].sort().join(','));
          }
        }
      }
      const existingSig = new Map<string, string>();
      const existingByAttr = new Map<string, Existing['attributeValues']>();
      for (const av of existing?.attributeValues ?? []) {
        const l = existingByAttr.get(av.attributeId) ?? [];
        l.push(av);
        existingByAttr.set(av.attributeId, l);
      }
      for (const [attrId, vals] of existingByAttr) {
        const def = defs.find((d) => d.id === attrId);
        if (!def) continue;
        const sig =
          def.type === 'select' || def.type === 'multiselect'
            ? vals
                .map((v) => v.optionId)
                .sort()
                .join(',')
            : def.type === 'number'
              ? (() => {
                  const raw = String(vals[0]?.valueNumber ?? '');
                  const p = parseDecimal(raw);
                  return p.ok ? p.value : raw;
                })()
              : def.type === 'boolean'
                ? String(vals[0]?.valueBool)
                : (vals[0]?.valueText ?? '');
        existingSig.set(attrId, sig);
      }
      const prunedIds = [...existingByAttr.keys()].filter((id) => !defs.some((d) => d.id === id));
      const attrsDirty =
        prunedIds.length > 0 ||
        [...presentIds].some((id) => existingSig.get(id) !== desiredSig.get(id));
      const attrDeleteIds = [...new Set([...presentIds, ...prunedIds])];

      // ---- options (file layout)
      const optSpecified = has('option1_name_en');
      interface FileOpt {
        nameEn: string;
        nameBn: string | null;
        values: Map<string, { en: string; bn: string | null }>;
      }
      let fileOpts: FileOpt[] = [];
      /** Per row: lower-case value key per option position. */
      const combos = new Map<Row, string[]>();
      if (optSpecified) {
        const firstNames = [1, 2].map((i) => (first.v[`option${i}_name_en`] ?? '').trim());
        const k = firstNames[0] ? (firstNames[1] ? 2 : 1) : 0;
        if (!firstNames[0] && firstNames[1]) {
          e(first.row, 'option1_name_en', 'Option 2 needs option 1');
        }
        fileOpts = Array.from({ length: k }, (_, i) => ({
          nameEn: firstNames[i] as string,
          nameBn: null,
          values: new Map(),
        }));
        const comboRows = new Map<string, number>();
        for (const r of group) {
          const names = [1, 2].map((i) => norm(r.v[`option${i}_name_en`] ?? ''));
          for (let i = 0; i < 2; i++) {
            if (names[i] !== norm(firstNames[i] ?? '')) {
              e(
                r.row,
                `option${i + 1}_name_en`,
                'Option names must be the same on every row of a product',
              );
            }
          }
          if (k === 0) continue;
          const keys: string[] = [];
          for (let i = 0; i < k; i++) {
            const en = (r.v[`option${i + 1}_value_en`] ?? '').trim();
            if (!en) {
              e(r.row, `option${i + 1}_value_en`, 'Required when the product has options');
              continue;
            }
            if (en.length > 100) e(r.row, `option${i + 1}_value_en`, 'At most 100 characters');
            const bn = (r.v[`option${i + 1}_value_bn`] ?? '').trim() || null;
            const opt = fileOpts[i] as FileOpt;
            const old = opt.values.get(norm(en));
            if (old && bn && old.bn && old.bn !== bn) {
              e(
                r.row,
                `option${i + 1}_value_bn`,
                `Differs from the Bangla value of "${en}" on an earlier row`,
              );
            }
            if (!old) opt.values.set(norm(en), { en, bn });
            else if (!old.bn && bn) old.bn = bn;
            keys.push(norm(en));
            const nameBn = (r.v[`option${i + 1}_name_bn`] ?? '').trim();
            if (nameBn) {
              if (opt.nameBn && opt.nameBn !== nameBn) {
                e(
                  r.row,
                  `option${i + 1}_name_bn`,
                  'Option names must be the same on every row of a product',
                );
              }
              opt.nameBn ??= nameBn;
            }
          }
          if (keys.length === k) {
            const key = keys.join('\u0001');
            const dup = comboRows.get(key);
            if (dup !== undefined) {
              e(r.row, 'option1_value_en', `Same option combination as row ${dup}`);
            } else comboRows.set(key, r.row);
            combos.set(r, keys);
          }
        }
        if (k === 0 && group.length > 1) {
          e(
            group[1]?.row ?? first.row,
            'option1_name_en',
            'A product with several variants needs option columns',
          );
        }
        if (fileOpts.some((o) => o.values.size > 100) || group.length > 200) {
          e(first.row, 'sku', 'At most 200 variants and 100 values per option');
        }
        if (k > 0 && !has('option1_name_bn')) {
          fileOpts.forEach((o, i) => {
            o.nameBn = existing?.options.find((x) => x.position === i + 1)?.nameBn ?? null;
          });
        }
      }

      // ---- variants
      const existingBySku = new Map(existing?.variants.map((v) => [v.sku, v]) ?? []);
      const valueKeyById = new Map<string, string>();
      for (const o of existing?.options ?? []) {
        for (const v of o.values) valueKeyById.set(v.id, norm(v.valueEn));
      }
      const existingKeys = (v: ExistingVariant) =>
        [v.optionValue1Id, v.optionValue2Id].map((id) => (id ? (valueKeyById.get(id) ?? '') : ''));
      const existingOptCount = existing?.options.length ?? 0;

      if (!optSpecified) {
        // Variant-only file: option structure comes from the stored product.
        fileOpts = (existing?.options ?? []).map((o) => ({
          nameEn: o.nameEn,
          nameBn: o.nameBn,
          values: new Map(o.values.map((v) => [norm(v.valueEn), { en: v.valueEn, bn: v.valueBn }])),
        }));
        if (!existing && group.length > 1) {
          e(
            group[1]?.row ?? first.row,
            'option1_name_en',
            'A product with several variants needs option columns',
          );
        }
        for (const r of existing ? group : []) {
          const ev = existingBySku.get(r.v.sku ?? '');
          if (!ev) {
            e(r.row, 'sku', 'Option columns are needed to add variants to an existing product');
            continue;
          }
          combos.set(r, existingKeys(ev).slice(0, existingOptCount));
        }
      }
      const k = fileOpts.length;

      const fileSkus = new Set(group.map((r) => r.v.sku ?? ''));
      const untouched = (existing?.variants ?? []).filter((v) => {
        if (fileSkus.has(v.sku)) return false;
        return k === 0
          ? v.isActive
          : existingKeys(v).slice(0, existingOptCount).every(Boolean) && existingOptCount > 0;
      });
      if (untouched.length > 0 && (existingOptCount !== k || k === 0)) {
        e(
          first.row,
          'sku',
          k === 0
            ? `A product without options has exactly one variant; existing SKU ${untouched[0]?.sku} is not in the file`
            : `The option layout changed but ${untouched.length} existing variant(s) (e.g. ${untouched[0]?.sku}) are not in the file; list every variant`,
        );
      }
      const untouchedKeys = untouched.map((v) => existingKeys(v).slice(0, k));
      for (const r of group) {
        const keys = combos.get(r);
        if (!keys || k === 0) continue;
        const clash = untouched.find(
          (_, i) => (untouchedKeys[i] ?? []).join('\u0001') === keys.join('\u0001'),
        );
        if (clash)
          e(
            r.row,
            'option1_value_en',
            `Option combination is used by existing variant ${clash.sku}`,
          );
      }

      // final option payload
      const finalOpts: VariantsPayload['options'] = [];
      const valueIndex: Map<string, number>[] = [];
      for (let i = 0; i < k; i++) {
        const fo = fileOpts[i] as FileOpt;
        const eo = existing?.options.find((o) => o.position === i + 1);
        const keepKeys = new Set(untouchedKeys.map((ks) => ks[i]));
        const values: VariantsPayload['options'][number]['values'] = [];
        const index = new Map<string, number>();
        for (const ev of eo?.values ?? []) {
          const key = norm(ev.valueEn);
          const fv = fo.values.get(key);
          if (fv || keepKeys.has(key)) {
            index.set(key, values.length);
            values.push({
              id: ev.id,
              valueEn: fv?.en ?? ev.valueEn,
              valueBn: fv ? (has(`option${i + 1}_value_bn`) ? fv.bn : ev.valueBn) : ev.valueBn,
              swatchHex: ev.swatchHex,
            });
          }
        }
        for (const [key, fv] of fo.values) {
          if (index.has(key)) continue;
          index.set(key, values.length);
          values.push({ valueEn: fv.en, valueBn: fv.bn });
        }
        valueIndex.push(index);
        finalOpts.push({
          position: (i + 1) as 1 | 2,
          nameEn: fo.nameEn,
          nameBn: fo.nameBn,
          values,
        });
      }
      const optionsDirty =
        k !== existingOptCount ||
        finalOpts.some((o, i) => {
          const eo = existing?.options[i];
          return (
            !eo ||
            eo.nameEn !== o.nameEn ||
            (eo.nameBn ?? null) !== (o.nameBn ?? null) ||
            eo.values.length !== o.values.length ||
            o.values.some((v, j) => {
              const ev = eo.values[j];
              return (
                !ev ||
                ev.id !== v.id ||
                ev.valueEn !== v.valueEn ||
                (ev.valueBn ?? null) !== (v.valueBn ?? null)
              );
            })
          );
        });

      // per file row
      type Entry = {
        sort: number;
        v: VariantsPayload['variants'][number];
        plan: VariantPlan;
        dirty: boolean;
      };
      const entries: Entry[] = [];
      let newOrder = 1_000_000;
      for (const r of group) {
        const sku = r.v.sku ?? '';
        const ev = existingBySku.get(sku);
        const cell = (name: string) => (has(name) ? (r.v[name] ?? '') : undefined);
        const bad = (column: string, message: string) => e(r.row, column, message);
        const money = (name: string): number | null | undefined => {
          const raw = cell(name);
          if (raw === undefined) return undefined;
          if (!raw) return null;
          const p = parsePrice(raw);
          if (p.ok) return p.value;
          bad(name, p.error);
          return undefined;
        };
        const int = (name: string, max?: number): number | null | undefined => {
          const raw = cell(name);
          if (raw === undefined) return undefined;
          if (!raw) return null;
          const p = parseInteger(raw, max);
          if (p.ok) return p.value;
          bad(name, p.error);
          return undefined;
        };

        const priceRaw = cell('price');
        const price = money('price');
        if (!ev && !priceRaw) bad('price', 'Required to create a variant');
        const compareAt = money('compare_at_price');
        const sale = money('sale_price');
        let cost: number | null | undefined;
        if (has(COST_COLUMN)) {
          if (perms.has('products.view_cost')) cost = money(COST_COLUMN);
          else if (cell(COST_COLUMN)) bad(COST_COLUMN, 'Needs the products.view_cost permission');
        }
        const weight = int('weight_g_variant', 1_000_000);
        const threshold = int('low_stock_threshold', 1_000_000);
        const onHandRaw = cell('on_hand');
        let onHand: number | undefined;
        if (onHandRaw) {
          const p = parseInteger(onHandRaw, 1_000_000_000);
          if (p.ok) onHand = p.value;
          else bad('on_hand', p.error);
        }
        let isActive = ev?.isActive ?? true;
        const activeRaw = cell('variant_active');
        if (activeRaw) {
          const p = parseBool(activeRaw);
          if (p.ok) isActive = p.value;
          else bad('variant_active', p.error);
        }

        const finalPrice = price ?? ev?.priceP ?? 0;
        const finalCompare = compareAt === undefined ? (ev?.compareAtP ?? null) : compareAt;
        const finalSale = sale === undefined ? (ev?.salePriceP ?? null) : sale;
        if (finalSale != null && finalSale >= finalPrice)
          bad('sale_price', 'Sale price must be below the price');
        if (finalCompare != null && finalCompare <= finalPrice)
          bad('compare_at_price', 'Compare-at price must be above the price');

        const priceChanged = ev
          ? finalPrice !== ev.priceP ||
            finalCompare !== ev.compareAtP ||
            finalSale !== ev.salePriceP
          : finalPrice !== 0 || finalCompare != null || finalSale != null;
        if (priceChanged && !perms.has('products.edit_price')) {
          bad('price', 'Changing prices needs the products.edit_price permission');
        }

        const keys = combos.get(r) ?? [];
        const refs = keys.map((key, i) => valueIndex[i]?.get(key) ?? 0);
        const keepSale = finalSale != null;
        const payload: Entry['v'] = {
          id: ev?.id,
          optionValueRefs: refs,
          sku,
          barcode: has('barcode') ? (r.v.barcode ?? '') || null : (ev?.barcode ?? null),
          priceP: finalPrice,
          compareAtP: finalCompare,
          salePriceP: finalSale,
          saleStartsAt: keepSale ? (ev?.saleStartsAt?.toISOString() ?? null) : null,
          saleEndsAt: keepSale ? (ev?.saleEndsAt?.toISOString() ?? null) : null,
          costP: cost,
          weightG: weight === undefined ? (ev?.weightG ?? null) : weight,
          isActive,
          lowStockThreshold: threshold,
        };
        if ((payload.barcode?.length ?? 0) > 64) bad('barcode', 'At most 64 characters');

        let kind: Kind = 'create';
        let dirty = true;
        let stockDelta = onHand ?? 0;
        if (ev) {
          const comboChanged =
            k !== existingOptCount ||
            existingKeys(ev).slice(0, k).join('\u0001') !== keys.join('\u0001');
          const fieldsDirty =
            comboChanged ||
            payload.barcode !== ev.barcode ||
            payload.priceP !== ev.priceP ||
            payload.compareAtP !== ev.compareAtP ||
            payload.salePriceP !== ev.salePriceP ||
            (cost !== undefined && cost !== ev.costP) ||
            payload.weightG !== ev.weightG ||
            isActive !== ev.isActive ||
            (threshold !== undefined && threshold !== (ev.inventory?.lowStockThreshold ?? null));
          const current = ev.inventory?.onHand ?? 0;
          stockDelta = onHand === undefined ? 0 : onHand - current;
          if (
            stockDelta < 0 &&
            (data.fulfillment ?? existing?.fulfillment) === 'stock' &&
            onHand !== undefined &&
            onHand < (ev.inventory?.reserved ?? 0)
          ) {
            bad('on_hand', `Below the ${ev.inventory?.reserved} unit(s) reserved for orders`);
          }
          kind = fieldsDirty || stockDelta !== 0 ? 'update' : 'unchanged';
          dirty = fieldsDirty;
        }
        entries.push({
          sort: ev ? ev.sort : newOrder++,
          v: payload,
          plan: { sku, kind, onHand, stockDelta },
          dirty,
        });
      }
      for (const u of untouched) {
        const ks = existingKeys(u).slice(0, k);
        entries.push({
          sort: u.sort,
          v: {
            id: u.id,
            optionValueRefs: ks.map((key, i) => valueIndex[i]?.get(key) ?? 0),
            sku: u.sku,
            barcode: u.barcode,
            priceP: u.priceP,
            compareAtP: u.compareAtP,
            salePriceP: u.salePriceP,
            saleStartsAt: u.saleStartsAt?.toISOString() ?? null,
            saleEndsAt: u.saleEndsAt?.toISOString() ?? null,
            weightG: u.weightG,
            isActive: u.isActive,
          },
          plan: { sku: u.sku, kind: 'unchanged', stockDelta: 0 },
          dirty: false,
        });
      }
      entries.sort((a, b) => a.sort - b.sort);
      const payload: VariantsPayload = {
        options: finalOpts,
        variants: entries.map((x) => x.v),
      };
      const variantPlans = entries
        .filter((x) => group.some((r) => r.v.sku === x.plan.sku))
        .map((x) => x.plan);
      const callApply = !existing || optionsDirty || entries.some((x) => !x.v.id || x.dirty);

      // ---- activation rules (same as the publish action)
      if (statusAfter === 'active' && existing?.status !== 'active') {
        if (!entries.some((x) => x.v.isActive && x.v.priceP > 0)) {
          e(first.row, 'status', 'Cannot activate: needs an active variant with a price above 0');
        }
        if (!primaryActive)
          e(first.row, 'status', 'Cannot activate: primary category is not active');
        const have = new Set([
          ...[...existingByAttr.keys()].filter(
            (id) => !presentIds.has(id) && !prunedIds.includes(id),
          ),
          ...desiredSig.keys(),
        ]);
        for (const d of defs) {
          if (d.isRequired && !have.has(d.id)) {
            e(first.row, 'status', `Cannot activate: required attribute "${d.nameEn}" is missing`);
          }
        }
      }
      if (existing && statusAfter !== existing.status) data.status = statusAfter;
      if (!existing) data.status = statusAfter;

      // ---- product kind
      let dirtyData = data;
      if (existing) {
        dirtyData = Object.fromEntries(
          Object.entries(data).filter(
            ([key, val]) => !same((existing as unknown as Record<string, unknown>)[key], val),
          ),
        );
      }
      const anyVariantChange = variantPlans.some((v) => v.kind !== 'unchanged');
      const kind: Kind = !existing
        ? 'create'
        : Object.keys(dirtyData).length ||
            catsDirty ||
            attrsDirty ||
            optionsDirty ||
            anyVariantChange
          ? 'update'
          : 'unchanged';

      out.products.push({
        slug,
        kind,
        existing,
        data: dirtyData,
        statusAfter,
        categoryIds,
        catsDirty,
        attrDeleteIds,
        attrRows,
        attrsDirty,
        payload,
        callApply,
        variants: variantPlans,
      });
    }
    return out;
  }

  private async findByChunks<T>(items: string[], find: (chunk: string[]) => Promise<T[]>) {
    const out: T[] = [];
    for (let i = 0; i < items.length; i += 1000)
      out.push(...(await find(items.slice(i, i + 1000))));
    return out;
  }

  // ---- applying -----------------------------------------------------------------------------

  private async apply(tx: Tx, actor: StaffAuthContext, p: ProductPlan) {
    const { existing } = p;
    const data = { ...p.data } as Record<string, unknown>;
    if (typeof data.preorderExpectedDate === 'string') {
      data.preorderExpectedDate = new Date(data.preorderExpectedDate);
    }
    if (data.status !== undefined) {
      const now = new Date();
      data.archivedAt = data.status === 'archived' ? now : null;
      if (data.status === 'active') data.publishedAt = existing?.publishedAt ?? now;
    }

    let productId: string;
    if (!existing) {
      const seller =
        (await tx.seller.findFirst({ orderBy: { createdAt: 'asc' } })) ??
        (await tx.seller.create({ data: { name: 'Store' } }));
      const { primaryCategoryId, ...rest } = data;
      const created = await tx.product.create({
        data: {
          ...(rest as Omit<Prisma.ProductUncheckedCreateInput, 'sellerId' | 'slug'>),
          titleEn: String(data.titleEn),
          primaryCategoryId: String(primaryCategoryId),
          sellerId: seller.id,
          slug: p.slug,
          categories: { create: p.categoryIds.map((categoryId) => ({ categoryId })) },
        },
      });
      productId = created.id;
    } else {
      productId = existing.id;
      if (Object.keys(data).length) {
        await tx.product.update({
          where: { id: productId },
          data: data as Prisma.ProductUncheckedUpdateInput,
        });
      }
      if (p.catsDirty) {
        await tx.productCategory.deleteMany({
          where: { productId, categoryId: { notIn: p.categoryIds } },
        });
        await tx.productCategory.createMany({
          data: p.categoryIds.map((categoryId) => ({ productId, categoryId })),
          skipDuplicates: true,
        });
      }
    }

    if (p.callApply) await this.variants.apply(tx, actor.permissions, productId, p.payload);

    if (!existing || p.attrsDirty) {
      if (p.attrDeleteIds.length) {
        await tx.productAttributeValue.deleteMany({
          where: { productId, attributeId: { in: p.attrDeleteIds } },
        });
      }
      if (p.attrRows.length) {
        await tx.productAttributeValue.createMany({
          data: p.attrRows.map((r) => ({ ...r, productId })),
        });
      }
    }

    const stock = p.variants.filter((v) => v.stockDelta !== 0);
    if (stock.length) {
      const rows = await tx.variant.findMany({
        where: { productId, sku: { in: stock.map((s) => s.sku) } },
        select: { id: true, sku: true },
      });
      const idBySku = new Map(rows.map((r) => [r.sku, r.id]));
      for (const s of stock) {
        const variantId = idBySku.get(s.sku);
        if (!variantId || s.onHand === undefined) continue;
        const delta = s.onHand - (await this.inventory.lockedOnHand(tx, variantId));
        if (delta === 0) continue;
        await this.inventory.move(tx, {
          variantId,
          qtyDelta: delta,
          reservedDelta: 0,
          reason: 'import',
          staffId: actor.staff.id,
          note: 'bulk import',
        });
      }
    }
  }
}

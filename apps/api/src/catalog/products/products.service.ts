import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { StaffAuthContext } from '../../auth/staff-auth.service';
import { ENV, type Env } from '../../config/env';
import { Prisma } from '../../generated/prisma/client';
import { imgproxyConfig, imgproxyUrl } from '../../media/imgproxy';
import { PrismaService } from '../../prisma/prisma.service';
import { sanitizeDescriptionHtml } from '../html/sanitize';
import type {
  AttributeValueInput,
  CreateProductDto,
  ImageInput,
  ListProductsQueryDto,
  ProductDetail,
  ProductListView,
  UpdateProductDto,
} from './products.dto';
import { pickSlug, rethrowUnique, slugify } from './slug';
import { VariantsService } from './variants.service';

type Tx = Prisma.TransactionClient;
type Db = Tx | PrismaService;

const blank = (v: string | null | undefined) => (v?.trim() ? v.trim() : null);
const html = (v: string | null | undefined) => (v ? sanitizeDescriptionHtml(v) || null : null);

const detailInclude = {
  brand: { select: { id: true, nameEn: true } },
  categories: { include: { category: { select: { id: true, nameEn: true, nameBn: true } } } },
  attributeValues: true,
  options: { include: { values: { orderBy: { sort: 'asc' } } }, orderBy: { position: 'asc' } },
  variants: { include: { inventory: true }, orderBy: { sort: 'asc' } },
  images: { include: { media: { select: { storageKey: true } } }, orderBy: { sort: 'asc' } },
} satisfies Prisma.ProductInclude;

@Injectable()
export class ProductsService {
  private readonly imgproxy;

  constructor(
    private readonly prisma: PrismaService,
    private readonly variants: VariantsService,
    @Inject(ENV) env: Env,
  ) {
    this.imgproxy = imgproxyConfig(env);
  }

  // ---- reads ---------------------------------------------------------------------------------

  async list(q: ListProductsQueryDto): Promise<ProductListView> {
    const where: Prisma.Sql[] = [];
    if (q.status) where.push(Prisma.sql`p.status = ${q.status}::product_status`);
    if (q.brandId) where.push(Prisma.sql`p.brand_id = ${q.brandId}::uuid`);
    if (q.fulfillment) where.push(Prisma.sql`p.fulfillment = ${q.fulfillment}::fulfillment`);
    if (q.isUpcoming) where.push(Prisma.sql`p.is_upcoming = ${q.isUpcoming === 'true'}`);
    if (q.isPreorder) where.push(Prisma.sql`p.is_preorder = ${q.isPreorder === 'true'}`);
    if (q.q) {
      const like = `%${q.q.replace(/[\\%_]/g, '\\$&')}%`;
      where.push(Prisma.sql`(p.title_en ILIKE ${like} OR p.title_bn ILIKE ${like} OR p.slug ILIKE ${like}
        OR EXISTS (SELECT 1 FROM variants v WHERE v.product_id = p.id AND v.sku ILIKE ${like}))`);
    }
    if (q.categoryId) {
      // Category plus all descendants: any of the product's categories under its path prefix.
      where.push(Prisma.sql`EXISTS (
        SELECT 1 FROM product_categories pc JOIN categories c ON c.id = pc.category_id
        WHERE pc.product_id = p.id
          AND c.path LIKE (SELECT path FROM categories WHERE id = ${q.categoryId}::uuid) || '%')`);
    }
    if (q.lowStock === 'true') {
      where.push(Prisma.sql`p.fulfillment = 'stock' AND EXISTS (
        SELECT 1 FROM variants v JOIN inventory i ON i.variant_id = v.id
        WHERE v.product_id = p.id AND v.is_active AND i.low_stock_threshold IS NOT NULL
          AND i.on_hand - i.reserved <= i.low_stock_threshold)`);
    }
    const whereSql = where.length ? Prisma.sql`WHERE ${Prisma.join(where, ' AND ')}` : Prisma.empty;

    const dir = q.order ?? (q.sort === 'createdAt' ? 'desc' : 'asc');
    const d = dir === 'desc' ? Prisma.sql`DESC` : Prisma.sql`ASC`;
    const orderSql =
      q.sort === 'title'
        ? Prisma.sql`lower(p.title_en) ${d}, p.id ${d}`
        : q.sort === 'price'
          ? Prisma.sql`(SELECT min(v.price_p) FROM variants v WHERE v.product_id = p.id AND v.is_active) ${d} NULLS LAST, p.id ${d}`
          : Prisma.sql`p.created_at ${d}, p.id ${d}`;

    const [countRow] = await this.prisma.$queryRaw<{ count: bigint }[]>(
      Prisma.sql`SELECT count(*) AS count FROM products p ${whereSql}`,
    );
    const idRows = await this.prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT p.id FROM products p ${whereSql} ORDER BY ${orderSql}
      LIMIT ${q.pageSize} OFFSET ${(q.page - 1) * q.pageSize}`);
    const ids = idRows.map((r) => r.id);

    const rows = await this.prisma.product.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        titleEn: true,
        titleBn: true,
        slug: true,
        status: true,
        updatedAt: true,
        brand: { select: { id: true, nameEn: true } },
        primaryCategory: { select: { id: true, nameEn: true } },
        images: {
          orderBy: { sort: 'asc' },
          select: { variantId: true, media: { select: { storageKey: true } } },
        },
        variants: {
          select: {
            priceP: true,
            isActive: true,
            inventory: { select: { onHand: true, reserved: true } },
          },
        },
      },
    });
    const byId = new Map(rows.map((r) => [r.id, r]));
    const items = ids.flatMap((id) => {
      const r = byId.get(id);
      if (!r) return [];
      const active = r.variants.filter((v) => v.isActive);
      const priced = (active.length ? active : r.variants).map((v) => v.priceP);
      const thumb = r.images.find((i) => i.variantId === null) ?? r.images[0];
      return [
        {
          id: r.id,
          titleEn: r.titleEn,
          titleBn: r.titleBn,
          slug: r.slug,
          status: r.status,
          brand: r.brand,
          primaryCategory: r.primaryCategory,
          thumbnailUrl: thumb
            ? imgproxyUrl(this.imgproxy, thumb.media.storageKey, {
                width: 160,
                height: 160,
                resize: 'fill',
              })
            : null,
          variantCount: r.variants.length,
          minP: priced.length ? Math.min(...priced) : null,
          maxP: priced.length ? Math.max(...priced) : null,
          totalAvailable: active.reduce(
            (sum, v) => sum + (v.inventory ? v.inventory.onHand - v.inventory.reserved : 0),
            0,
          ),
          updatedAt: r.updatedAt.toISOString(),
        },
      ];
    });
    return { items, total: Number(countRow?.count ?? 0), page: q.page, pageSize: q.pageSize };
  }

  async detail(actor: StaffAuthContext, id: string): Promise<ProductDetail> {
    return this.detailWith(this.prisma, actor, id);
  }

  private async detailWith(db: Db, actor: StaffAuthContext, id: string): Promise<ProductDetail> {
    const p = await db.product.findUnique({ where: { id }, include: detailInclude });
    if (!p) throw new NotFoundException('Product not found');
    const showCost = actor.permissions.has('products.view_cost');

    const grouped = new Map<string, ProductDetail['attributeValues'][number]>();
    for (const av of p.attributeValues) {
      let g = grouped.get(av.attributeId);
      if (!g) {
        g = {
          attributeId: av.attributeId,
          valueText: av.valueText,
          valueNumber: av.valueNumber === null ? null : Number(av.valueNumber),
          valueBool: av.valueBool,
          optionIds: [],
        };
        grouped.set(av.attributeId, g);
      }
      if (av.optionId) g.optionIds.push(av.optionId);
    }

    return {
      id: p.id,
      titleEn: p.titleEn,
      titleBn: p.titleBn,
      slug: p.slug,
      shortDescriptionEn: p.shortDescriptionEn,
      shortDescriptionBn: p.shortDescriptionBn,
      descriptionHtmlEn: p.descriptionHtmlEn,
      descriptionHtmlBn: p.descriptionHtmlBn,
      youtubeUrl: p.youtubeUrl,
      status: p.status,
      fulfillment: p.fulfillment,
      hasVariants: p.hasVariants,
      brandId: p.brandId,
      brand: p.brand,
      primaryCategoryId: p.primaryCategoryId,
      categories: p.categories
        .map((c) => ({ ...c.category, isPrimary: c.categoryId === p.primaryCategoryId }))
        .sort(
          (a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.nameEn.localeCompare(b.nameEn),
        ),
      weightG: p.weightG,
      deliveryChargeOverrideP: p.deliveryChargeOverrideP,
      returnWindowDays: p.returnWindowDays,
      isPreorder: p.isPreorder,
      preorderExpectedDate: p.preorderExpectedDate?.toISOString().slice(0, 10) ?? null,
      isUpcoming: p.isUpcoming,
      advancePercent: p.advancePercent,
      isPinned: p.isPinned,
      pinBoost: p.pinBoost,
      seoTitle: p.seoTitle,
      seoDescription: p.seoDescription,
      publishedAt: p.publishedAt?.toISOString() ?? null,
      archivedAt: p.archivedAt?.toISOString() ?? null,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      attributeValues: [...grouped.values()],
      options: p.options.map((o) => ({
        id: o.id,
        position: o.position,
        nameEn: o.nameEn,
        nameBn: o.nameBn,
        values: o.values.map((v) => ({
          id: v.id,
          valueEn: v.valueEn,
          valueBn: v.valueBn,
          swatchHex: v.swatchHex,
          sort: v.sort,
        })),
      })),
      variants: p.variants.map((v) => {
        const onHand = v.inventory?.onHand ?? 0;
        const reserved = v.inventory?.reserved ?? 0;
        return {
          id: v.id,
          sku: v.sku,
          barcode: v.barcode,
          optionValueIds: [v.optionValue1Id, v.optionValue2Id],
          priceP: v.priceP,
          compareAtP: v.compareAtP,
          salePriceP: v.salePriceP,
          saleStartsAt: v.saleStartsAt?.toISOString() ?? null,
          saleEndsAt: v.saleEndsAt?.toISOString() ?? null,
          ...(showCost && { costP: v.costP }),
          weightG: v.weightG,
          isActive: v.isActive,
          sort: v.sort,
          onHand,
          reserved,
          available: onHand - reserved,
          lowStockThreshold: v.inventory?.lowStockThreshold ?? null,
        };
      }),
      images: p.images.map((i) => ({
        id: i.id,
        mediaId: i.mediaId,
        variantId: i.variantId,
        sort: i.sort,
        alt: i.alt,
        url: imgproxyUrl(this.imgproxy, i.media.storageKey, { width: 600, height: 600 }),
        thumbUrl: imgproxyUrl(this.imgproxy, i.media.storageKey, {
          width: 160,
          height: 160,
          resize: 'fill',
        }),
      })),
    };
  }

  // ---- helpers -------------------------------------------------------------------------------

  private async sellerId(db: Db) {
    const seller = await db.seller.findFirst({ orderBy: { createdAt: 'asc' } });
    return (seller ?? (await db.seller.create({ data: { name: 'Store' } }))).id;
  }

  private async freeSlug(db: Db, base: string) {
    const taken = await db.product.findMany({
      where: { slug: { startsWith: base } },
      select: { slug: true },
    });
    return pickSlug(base, new Set(taken.map((t) => t.slug)));
  }

  private async assertCategories(db: Db, ids: string[]) {
    const found = await db.category.count({ where: { id: { in: ids } } });
    if (found !== ids.length) throw new BadRequestException('Unknown category');
  }

  private async assertBrand(db: Db, id: string | null | undefined) {
    if (id && !(await db.brand.findUnique({ where: { id }, select: { id: true } }))) {
      throw new BadRequestException('Unknown brand');
    }
  }

  /** Attributes (with options) of the given categories and all their ancestors. */
  private async inheritedAttributes(db: Db, categoryIds: string[]) {
    const cats = await db.category.findMany({
      where: { id: { in: categoryIds } },
      select: { path: true },
    });
    const ids = [...new Set(cats.flatMap((c) => c.path.split('/').filter(Boolean)))];
    return db.categoryAttribute.findMany({
      where: { categoryId: { in: ids } },
      include: { options: true },
    });
  }

  /** Replaces the product's attribute values after validating them against inherited attributes. */
  private async writeAttributes(
    tx: Tx,
    productId: string,
    categoryIds: string[],
    input: AttributeValueInput[],
  ) {
    const defs = new Map((await this.inheritedAttributes(tx, categoryIds)).map((a) => [a.id, a]));
    const seen = new Set<string>();
    const rows: Prisma.ProductAttributeValueCreateManyInput[] = [];
    const bad = (m: string) => new BadRequestException(m);
    for (const v of input) {
      const def = defs.get(v.attributeId);
      if (!def) throw bad(`Attribute ${v.attributeId} does not apply to this product's categories`);
      if (seen.has(def.id)) throw bad(`Attribute "${def.nameEn}" given twice`);
      seen.add(def.id);
      const provided = {
        text: v.valueText !== undefined,
        number: v.valueNumber !== undefined,
        bool: v.valueBool !== undefined,
        options: v.optionIds !== undefined,
      };
      const only = (k: keyof typeof provided) =>
        Object.entries(provided).every(([name, on]) => (name === k ? on : !on));
      const base = { productId, attributeId: def.id };
      switch (def.type) {
        case 'text':
          if (!only('text') || !v.valueText?.trim()) throw bad(`"${def.nameEn}" needs valueText`);
          rows.push({ ...base, valueText: v.valueText.trim() });
          break;
        case 'number':
          if (!only('number')) throw bad(`"${def.nameEn}" needs valueNumber`);
          rows.push({ ...base, valueNumber: v.valueNumber });
          break;
        case 'boolean':
          if (!only('bool')) throw bad(`"${def.nameEn}" needs valueBool`);
          rows.push({ ...base, valueBool: v.valueBool });
          break;
        case 'select':
        case 'multiselect': {
          const optionIds = [...new Set(v.optionIds ?? [])];
          if (!only('options') || optionIds.length === 0)
            throw bad(`"${def.nameEn}" needs optionIds`);
          if (def.type === 'select' && optionIds.length !== 1) {
            throw bad(`"${def.nameEn}" takes exactly one option`);
          }
          const valid = new Set(def.options.map((o) => o.id));
          if (optionIds.some((id) => !valid.has(id))) throw bad(`"${def.nameEn}": unknown option`);
          for (const optionId of optionIds) rows.push({ ...base, optionId });
          break;
        }
      }
    }
    await tx.productAttributeValue.deleteMany({ where: { productId } });
    if (rows.length) await tx.productAttributeValue.createMany({ data: rows });
  }

  private async writeImages(tx: Tx, productId: string, images: ImageInput[]) {
    const mediaIds = [...new Set(images.map((i) => i.mediaId))];
    if ((await tx.media.count({ where: { id: { in: mediaIds } } })) !== mediaIds.length) {
      throw new BadRequestException('Unknown media');
    }
    const variantIds = [...new Set(images.flatMap((i) => (i.variantId ? [i.variantId] : [])))];
    if (
      variantIds.length &&
      (await tx.variant.count({ where: { id: { in: variantIds }, productId } })) !==
        variantIds.length
    ) {
      throw new BadRequestException('Image variant does not belong to this product');
    }
    await tx.productImage.deleteMany({ where: { productId } });
    if (images.length) {
      await tx.productImage.createMany({
        data: images.map((i, sort) => ({
          productId,
          mediaId: i.mediaId,
          variantId: i.variantId ?? null,
          alt: blank(i.alt),
          sort,
        })),
      });
    }
  }

  // ---- writes --------------------------------------------------------------------------------

  async create(actor: StaffAuthContext, body: CreateProductDto): Promise<ProductDetail> {
    const categoryIds = [...new Set([body.primaryCategoryId, ...(body.categoryIds ?? [])])];
    await this.assertCategories(this.prisma, categoryIds);
    await this.assertBrand(this.prisma, body.brandId);

    const id = await this.prisma
      .$transaction(async (tx) => {
        let slug = body.slug;
        if (slug) {
          if (await tx.product.findUnique({ where: { slug }, select: { id: true } })) {
            throw new ConflictException(`Slug "${slug}" is already used`);
          }
        } else {
          slug = await this.freeSlug(tx, slugify(body.titleEn) || 'product');
        }
        const product = await tx.product.create({
          data: {
            sellerId: await this.sellerId(tx),
            brandId: body.brandId ?? null,
            primaryCategoryId: body.primaryCategoryId,
            titleEn: body.titleEn,
            titleBn: blank(body.titleBn),
            slug,
            shortDescriptionEn: blank(body.shortDescriptionEn),
            shortDescriptionBn: blank(body.shortDescriptionBn),
            descriptionHtmlEn: html(body.descriptionHtmlEn),
            descriptionHtmlBn: html(body.descriptionHtmlBn),
            youtubeUrl: blank(body.youtubeUrl),
            fulfillment: body.fulfillment,
            weightG: body.weightG ?? null,
            deliveryChargeOverrideP: body.deliveryChargeOverrideP ?? null,
            returnWindowDays: body.returnWindowDays ?? null,
            isPreorder: body.isPreorder,
            preorderExpectedDate: body.preorderExpectedDate
              ? new Date(body.preorderExpectedDate)
              : null,
            isUpcoming: body.isUpcoming,
            advancePercent: body.advancePercent ?? null,
            isPinned: body.isPinned,
            pinBoost: body.pinBoost,
            seoTitle: blank(body.seoTitle),
            seoDescription: blank(body.seoDescription),
            categories: { create: categoryIds.map((categoryId) => ({ categoryId })) },
          },
        });

        if (body.variants) {
          await this.variants.apply(tx, actor.permissions, product.id, {
            options: body.options ?? [],
            variants: body.variants,
          });
        } else {
          // Every product has at least one variant; a draft starts with a blank default one.
          await tx.variant.create({
            data: {
              productId: product.id,
              sku: `SKU-${randomUUID().slice(0, 8).toUpperCase()}`,
              priceP: 0,
              inventory: { create: { onHand: 0 } },
            },
          });
        }
        if (body.attributes?.length) {
          await this.writeAttributes(tx, product.id, categoryIds, body.attributes);
        }
        if (body.images?.length) await this.writeImages(tx, product.id, body.images);
        return product.id;
      })
      .catch((e) => rethrowUnique(e, 'Slug or SKU already used'));
    return this.detail(actor, id);
  }

  async update(
    actor: StaffAuthContext,
    id: string,
    body: UpdateProductDto,
  ): Promise<ProductDetail> {
    const current = await this.prisma.product.findUnique({
      where: { id },
      include: { categories: { select: { categoryId: true } } },
    });
    if (!current) throw new NotFoundException('Product not found');
    await this.assertBrand(this.prisma, body.brandId);

    const primary = body.primaryCategoryId ?? current.primaryCategoryId;
    const categoryChange = body.primaryCategoryId !== undefined || body.categoryIds !== undefined;
    const categoryIds = [
      ...new Set([primary, ...(body.categoryIds ?? current.categories.map((c) => c.categoryId))]),
    ];
    if (categoryChange) await this.assertCategories(this.prisma, categoryIds);

    await this.prisma
      .$transaction(async (tx) => {
        if (body.slug && body.slug !== current.slug) {
          if (await tx.product.findUnique({ where: { slug: body.slug }, select: { id: true } })) {
            throw new ConflictException(`Slug "${body.slug}" is already used`);
          }
        }
        await tx.product.update({
          where: { id },
          data: {
            titleEn: body.titleEn,
            titleBn: body.titleBn === undefined ? undefined : blank(body.titleBn),
            slug: body.slug,
            shortDescriptionEn:
              body.shortDescriptionEn === undefined ? undefined : blank(body.shortDescriptionEn),
            shortDescriptionBn:
              body.shortDescriptionBn === undefined ? undefined : blank(body.shortDescriptionBn),
            descriptionHtmlEn:
              body.descriptionHtmlEn === undefined ? undefined : html(body.descriptionHtmlEn),
            descriptionHtmlBn:
              body.descriptionHtmlBn === undefined ? undefined : html(body.descriptionHtmlBn),
            youtubeUrl: body.youtubeUrl === undefined ? undefined : blank(body.youtubeUrl),
            brandId: body.brandId,
            primaryCategoryId: body.primaryCategoryId,
            fulfillment: body.fulfillment,
            weightG: body.weightG,
            deliveryChargeOverrideP: body.deliveryChargeOverrideP,
            returnWindowDays: body.returnWindowDays,
            isPreorder: body.isPreorder,
            preorderExpectedDate:
              body.preorderExpectedDate === undefined
                ? undefined
                : body.preorderExpectedDate
                  ? new Date(body.preorderExpectedDate)
                  : null,
            isUpcoming: body.isUpcoming,
            advancePercent: body.advancePercent,
            isPinned: body.isPinned,
            pinBoost: body.pinBoost,
            seoTitle: body.seoTitle === undefined ? undefined : blank(body.seoTitle),
            seoDescription:
              body.seoDescription === undefined ? undefined : blank(body.seoDescription),
          },
        });

        if (categoryChange) {
          await tx.productCategory.deleteMany({
            where: { productId: id, categoryId: { notIn: categoryIds } },
          });
          await tx.productCategory.createMany({
            data: categoryIds.map((categoryId) => ({ productId: id, categoryId })),
            skipDuplicates: true,
          });
        }
        if (body.attributes) {
          await this.writeAttributes(tx, id, categoryIds, body.attributes);
        } else if (categoryChange) {
          // Drop values of attributes the new categories no longer inherit.
          const valid = (await this.inheritedAttributes(tx, categoryIds)).map((a) => a.id);
          await tx.productAttributeValue.deleteMany({
            where: { productId: id, attributeId: { notIn: valid } },
          });
        }
      })
      .catch((e) => rethrowUnique(e, 'Slug already used'));
    return this.detail(actor, id);
  }

  async setImages(actor: StaffAuthContext, id: string, images: ImageInput[]) {
    await this.mustExist(id);
    await this.prisma.$transaction((tx) => this.writeImages(tx, id, images));
    return this.detail(actor, id);
  }

  async setVariants(
    actor: StaffAuthContext,
    id: string,
    payload: Parameters<VariantsService['set']>[2],
  ) {
    await this.variants.set(actor.permissions, id, payload);
    return this.detail(actor, id);
  }

  private async mustExist(id: string) {
    if (!(await this.prisma.product.findUnique({ where: { id }, select: { id: true } }))) {
      throw new NotFoundException('Product not found');
    }
  }

  // ---- status --------------------------------------------------------------------------------

  async publish(actor: StaffAuthContext, id: string) {
    const p = await this.prisma.product.findUnique({
      where: { id },
      include: {
        variants: { select: { isActive: true, priceP: true } },
        categories: { select: { categoryId: true } },
        primaryCategory: { select: { isActive: true } },
        attributeValues: { select: { attributeId: true } },
      },
    });
    if (!p) throw new NotFoundException('Product not found');

    const problems: string[] = [];
    if (!p.variants.some((v) => v.isActive && v.priceP > 0)) {
      problems.push('Needs at least one active variant with a price above 0');
    }
    if (!p.primaryCategory.isActive) problems.push('Primary category is not active');
    const have = new Set(p.attributeValues.map((a) => a.attributeId));
    const attrs = await this.inheritedAttributes(
      this.prisma,
      p.categories.map((c) => c.categoryId),
    );
    for (const a of attrs) {
      if (a.isRequired && !have.has(a.id))
        problems.push(`Required attribute "${a.nameEn}" is missing`);
    }
    if (problems.length) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Product is not ready to publish',
        problems,
      });
    }
    await this.prisma.product.update({
      where: { id },
      data: { status: 'active', archivedAt: null, publishedAt: p.publishedAt ?? new Date() },
    });
    return this.detail(actor, id);
  }

  async unpublish(actor: StaffAuthContext, id: string) {
    await this.mustExist(id);
    await this.prisma.product.update({
      where: { id },
      data: { status: 'draft', archivedAt: null },
    });
    return this.detail(actor, id);
  }

  async archive(actor: StaffAuthContext, id: string) {
    await this.mustExist(id);
    await this.prisma.product.update({
      where: { id },
      data: { status: 'archived', archivedAt: new Date() },
    });
    return this.detail(actor, id);
  }

  /** Hard delete. Once orders exist (step 4), products with orders are archived instead. */
  async remove(id: string) {
    await this.mustExist(id);
    await this.prisma.product.delete({ where: { id } });
  }

  /** Copies a product as a draft: new slug, SKUs suffixed -COPY(-n), no stock. */
  async duplicate(actor: StaffAuthContext, id: string): Promise<ProductDetail> {
    const src = await this.prisma.product.findUnique({
      where: { id },
      include: {
        categories: true,
        attributeValues: true,
        options: { include: { values: { orderBy: { sort: 'asc' } } } },
        variants: { include: { inventory: true }, orderBy: { sort: 'asc' } },
        images: { orderBy: { sort: 'asc' } },
      },
    });
    if (!src) throw new NotFoundException('Product not found');

    const newId = await this.prisma
      .$transaction(async (tx) => {
        const slug = await this.freeSlug(tx, `${src.slug}-copy`);
        const copy = await tx.product.create({
          data: {
            sellerId: src.sellerId,
            brandId: src.brandId,
            primaryCategoryId: src.primaryCategoryId,
            titleEn: `${src.titleEn} (copy)`,
            titleBn: src.titleBn,
            slug,
            shortDescriptionEn: src.shortDescriptionEn,
            shortDescriptionBn: src.shortDescriptionBn,
            descriptionHtmlEn: src.descriptionHtmlEn,
            descriptionHtmlBn: src.descriptionHtmlBn,
            youtubeUrl: src.youtubeUrl,
            status: 'draft',
            fulfillment: src.fulfillment,
            hasVariants: src.hasVariants,
            weightG: src.weightG,
            deliveryChargeOverrideP: src.deliveryChargeOverrideP,
            returnWindowDays: src.returnWindowDays,
            isPreorder: src.isPreorder,
            preorderExpectedDate: src.preorderExpectedDate,
            isUpcoming: src.isUpcoming,
            advancePercent: src.advancePercent,
            vatRateBp: src.vatRateBp,
            seoTitle: src.seoTitle,
            seoDescription: src.seoDescription,
            categories: { create: src.categories.map((c) => ({ categoryId: c.categoryId })) },
          },
        });
        if (src.attributeValues.length) {
          await tx.productAttributeValue.createMany({
            data: src.attributeValues.map((a) => ({
              productId: copy.id,
              attributeId: a.attributeId,
              valueText: a.valueText,
              valueNumber: a.valueNumber,
              valueBool: a.valueBool,
              optionId: a.optionId,
            })),
          });
        }

        const valueMap = new Map<string, string>();
        for (const opt of src.options) {
          const o = await tx.productOption.create({
            data: {
              productId: copy.id,
              position: opt.position,
              nameEn: opt.nameEn,
              nameBn: opt.nameBn,
            },
          });
          for (const v of opt.values) {
            const nv = await tx.productOptionValue.create({
              data: {
                optionId: o.id,
                valueEn: v.valueEn,
                valueBn: v.valueBn,
                swatchHex: v.swatchHex,
                sort: v.sort,
              },
            });
            valueMap.set(v.id, nv.id);
          }
        }

        const taken = new Set(
          (
            await tx.variant.findMany({
              where: { OR: src.variants.map((v) => ({ sku: { startsWith: `${v.sku}-COPY` } })) },
              select: { sku: true },
            })
          ).map((v) => v.sku),
        );
        const variantMap = new Map<string, string>();
        for (const v of src.variants) {
          const sku = pickSlug(`${v.sku}-COPY`, taken);
          taken.add(sku);
          const nv = await tx.variant.create({
            data: {
              productId: copy.id,
              sku,
              barcode: null,
              optionValue1Id: v.optionValue1Id ? (valueMap.get(v.optionValue1Id) ?? null) : null,
              optionValue2Id: v.optionValue2Id ? (valueMap.get(v.optionValue2Id) ?? null) : null,
              priceP: v.priceP,
              compareAtP: v.compareAtP,
              salePriceP: v.salePriceP,
              saleStartsAt: v.saleStartsAt,
              saleEndsAt: v.saleEndsAt,
              costP: v.costP,
              weightG: v.weightG,
              isActive: v.isActive,
              sort: v.sort,
              inventory: {
                create: { onHand: 0, lowStockThreshold: v.inventory?.lowStockThreshold },
              },
            },
          });
          variantMap.set(v.id, nv.id);
        }
        if (src.images.length) {
          await tx.productImage.createMany({
            data: src.images.map((i) => ({
              productId: copy.id,
              mediaId: i.mediaId,
              variantId: i.variantId ? (variantMap.get(i.variantId) ?? null) : null,
              sort: i.sort,
              alt: i.alt,
            })),
          });
        }
        return copy.id;
      })
      .catch((e) => rethrowUnique(e, 'Could not allocate a unique slug or SKU'));
    return this.detail(actor, newId);
  }
}

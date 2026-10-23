import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { slugSchemaPattern } from './slug';
import { isYoutubeUrl } from './youtube';

const money = z.number().int().min(0).max(2_000_000_000);
const uuid = z.uuid();
const text = (max: number) => z.string().trim().max(max);
const optText = (max: number) => text(max).nullable().optional();

// ---- inputs --------------------------------------------------------------------------------

const attributeValueInput = z.object({
  attributeId: uuid,
  valueText: text(1000).optional(),
  valueNumber: z.number().finite().optional(),
  valueBool: z.boolean().optional(),
  optionIds: z.array(uuid).max(100).optional(),
});

const optionInput = z.object({
  position: z.union([z.literal(1), z.literal(2)]),
  nameEn: text(50).min(1),
  nameBn: optText(50),
  values: z
    .array(
      z.object({
        id: uuid.optional(),
        valueEn: text(100).min(1),
        valueBn: optText(100),
        swatchHex: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .nullable()
          .optional(),
      }),
    )
    .min(1)
    .max(100),
});

/** Per option, in position order: an existing value id, or the index into that option's `values`. */
const optionValueRef = z.union([uuid, z.number().int().min(0)]);

const variantInput = z.object({
  id: uuid.optional(),
  optionValueRefs: z.array(optionValueRef).max(2).default([]),
  sku: text(64).min(1),
  barcode: optText(64),
  priceP: money,
  compareAtP: money.nullable().optional(),
  salePriceP: money.nullable().optional(),
  saleStartsAt: z.iso.datetime().nullable().optional(),
  saleEndsAt: z.iso.datetime().nullable().optional(),
  /** Omitted = keep the stored cost (also what staff without products.view_cost send). */
  costP: money.nullable().optional(),
  weightG: z.number().int().min(0).max(1_000_000).nullable().optional(),
  isActive: z.boolean().default(true),
  lowStockThreshold: z.number().int().min(0).max(1_000_000).nullable().optional(),
});

const variantsPayload = z.object({
  options: z.array(optionInput).max(2).default([]),
  variants: z.array(variantInput).min(1).max(200),
});

const imageInput = z.object({
  mediaId: uuid,
  variantId: uuid.nullable().optional(),
  alt: optText(250),
});

const productFields = {
  titleEn: text(250).min(1),
  titleBn: optText(250),
  slug: z.string().trim().toLowerCase().max(120).regex(slugSchemaPattern).optional(),
  shortDescriptionEn: optText(1000),
  shortDescriptionBn: optText(1000),
  descriptionHtmlEn: z.string().max(200_000).nullable().optional(),
  descriptionHtmlBn: z.string().max(200_000).nullable().optional(),
  youtubeUrl: text(300)
    .refine(isYoutubeUrl, 'Must be a YouTube watch, youtu.be or shorts link')
    .nullable()
    .optional(),
  brandId: uuid.nullable().optional(),
  primaryCategoryId: uuid,
  categoryIds: z.array(uuid).max(30).optional(),
  fulfillment: z.enum(['stock', 'dropship']).optional(),
  weightG: z.number().int().min(0).max(1_000_000).nullable().optional(),
  deliveryChargeOverrideP: money.nullable().optional(),
  returnWindowDays: z.number().int().min(0).max(365).nullable().optional(),
  isPreorder: z.boolean().optional(),
  preorderExpectedDate: z.iso.date().nullable().optional(),
  isUpcoming: z.boolean().optional(),
  advancePercent: z.number().int().min(1).max(100).nullable().optional(),
  isPinned: z.boolean().optional(),
  pinBoost: z.number().int().min(0).max(1000).optional(),
  seoTitle: optText(250),
  seoDescription: optText(500),
  attributes: z.array(attributeValueInput).max(100).optional(),
};

export const createProductSchema = z.object({
  ...productFields,
  /** Without `variants` a draft default variant (SKU auto, price 0) is created. */
  options: variantsPayload.shape.options.optional(),
  variants: variantsPayload.shape.variants.optional(),
  images: z.array(imageInput).max(50).optional(),
});
export class CreateProductDto extends createZodDto(createProductSchema) {}

export const updateProductSchema = z.object(productFields).partial();
export class UpdateProductDto extends createZodDto(updateProductSchema) {}

export type AttributeValueInput = z.infer<typeof attributeValueInput>;
export type VariantsPayload = z.infer<typeof variantsPayload>;
export type ImageInput = z.infer<typeof imageInput>;

export class SetVariantsDto extends createZodDto(variantsPayload) {}
export class SetImagesDto extends createZodDto(z.object({ images: z.array(imageInput).max(50) })) {}

export class ListProductsQueryDto extends createZodDto(
  z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    q: z.string().trim().max(100).optional(),
    status: z.enum(['draft', 'active', 'archived']).optional(),
    categoryId: uuid.optional(),
    brandId: uuid.optional(),
    fulfillment: z.enum(['stock', 'dropship']).optional(),
    isUpcoming: z.enum(['true', 'false']).optional(),
    isPreorder: z.enum(['true', 'false']).optional(),
    lowStock: z.enum(['true', 'false']).optional(),
    sort: z.enum(['createdAt', 'title', 'price']).default('createdAt'),
    order: z.enum(['asc', 'desc']).optional(),
  }),
) {}

// ---- outputs -------------------------------------------------------------------------------

const idName = z.object({ id: uuid, nameEn: z.string() });

const listItem = z.object({
  id: uuid,
  titleEn: z.string(),
  titleBn: z.string().nullable(),
  slug: z.string(),
  status: z.enum(['draft', 'active', 'archived']),
  brand: idName.nullable(),
  primaryCategory: idName,
  /** imgproxy 160x160 fill */
  thumbnailUrl: z.string().nullable(),
  variantCount: z.number().int(),
  minP: z.number().int().nullable(),
  maxP: z.number().int().nullable(),
  totalAvailable: z.number().int(),
  updatedAt: z.iso.datetime(),
});
export type ProductListItem = z.infer<typeof listItem>;

const listSchema = z.object({
  items: z.array(listItem),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
});
export type ProductListView = z.infer<typeof listSchema>;
export class ProductListDto extends createZodDto(listSchema) {}

const detailSchema = z.object({
  id: uuid,
  titleEn: z.string(),
  titleBn: z.string().nullable(),
  slug: z.string(),
  shortDescriptionEn: z.string().nullable(),
  shortDescriptionBn: z.string().nullable(),
  /** Already sanitized on save. */
  descriptionHtmlEn: z.string().nullable(),
  descriptionHtmlBn: z.string().nullable(),
  youtubeUrl: z.string().nullable(),
  status: z.enum(['draft', 'active', 'archived']),
  fulfillment: z.enum(['stock', 'dropship']),
  hasVariants: z.boolean(),
  brandId: uuid.nullable(),
  brand: idName.nullable(),
  primaryCategoryId: uuid,
  categories: z.array(
    z.object({
      id: uuid,
      nameEn: z.string(),
      nameBn: z.string().nullable(),
      isPrimary: z.boolean(),
    }),
  ),
  weightG: z.number().int().nullable(),
  deliveryChargeOverrideP: z.number().int().nullable(),
  returnWindowDays: z.number().int().nullable(),
  isPreorder: z.boolean(),
  preorderExpectedDate: z.string().nullable(),
  isUpcoming: z.boolean(),
  advancePercent: z.number().int().nullable(),
  isPinned: z.boolean(),
  pinBoost: z.number().int(),
  seoTitle: z.string().nullable(),
  seoDescription: z.string().nullable(),
  publishedAt: z.iso.datetime().nullable(),
  archivedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  attributeValues: z.array(
    z.object({
      attributeId: uuid,
      valueText: z.string().nullable(),
      valueNumber: z.number().nullable(),
      valueBool: z.boolean().nullable(),
      optionIds: z.array(uuid),
    }),
  ),
  options: z.array(
    z.object({
      id: uuid,
      position: z.number().int(),
      nameEn: z.string(),
      nameBn: z.string().nullable(),
      values: z.array(
        z.object({
          id: uuid,
          valueEn: z.string(),
          valueBn: z.string().nullable(),
          swatchHex: z.string().nullable(),
          sort: z.number().int(),
        }),
      ),
    }),
  ),
  variants: z.array(
    z.object({
      id: uuid,
      sku: z.string(),
      barcode: z.string().nullable(),
      optionValueIds: z.array(uuid.nullable()),
      priceP: z.number().int(),
      compareAtP: z.number().int().nullable(),
      salePriceP: z.number().int().nullable(),
      saleStartsAt: z.iso.datetime().nullable(),
      saleEndsAt: z.iso.datetime().nullable(),
      /** Only present with products.view_cost. */
      costP: z.number().int().nullable().optional(),
      weightG: z.number().int().nullable(),
      isActive: z.boolean(),
      sort: z.number().int(),
      onHand: z.number().int(),
      reserved: z.number().int(),
      available: z.number().int(),
      lowStockThreshold: z.number().int().nullable(),
    }),
  ),
  images: z.array(
    z.object({
      id: uuid,
      mediaId: uuid,
      variantId: uuid.nullable(),
      sort: z.number().int(),
      alt: z.string().nullable(),
      /** imgproxy 600x600 fit */
      url: z.string(),
      /** imgproxy 160x160 fill */
      thumbUrl: z.string(),
    }),
  ),
});
export type ProductDetail = z.infer<typeof detailSchema>;
export class ProductDetailDto extends createZodDto(detailSchema) {}

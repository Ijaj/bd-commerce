import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const slug = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'lowercase letters, digits and hyphens only');

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'hex colour like #4f46e5');

const mediaRef = z.object({ mediaId: z.uuid(), url: z.string() }).nullable();

export const attributeTypeSchema = z.enum(['text', 'number', 'select', 'multiselect', 'boolean']);

const optionSchema = z.object({
  id: z.uuid(),
  valueEn: z.string(),
  valueBn: z.string().nullable(),
  sort: z.number().int(),
});

export const attributeSchema = z.object({
  id: z.uuid(),
  categoryId: z.uuid(),
  key: z.string(),
  nameEn: z.string(),
  nameBn: z.string().nullable(),
  type: attributeTypeSchema,
  unit: z.string().nullable(),
  isFilterable: z.boolean(),
  isRequired: z.boolean(),
  sort: z.number().int(),
  options: z.array(optionSchema),
});

const inheritedAttributeSchema = attributeSchema.extend({
  inheritedFrom: z.object({ id: z.uuid(), nameEn: z.string() }),
});

export const categorySchema = z.object({
  id: z.uuid(),
  parentId: z.uuid().nullable(),
  level: z.number().int(),
  path: z.string(),
  nameEn: z.string(),
  nameBn: z.string().nullable(),
  slug: z.string(),
  descriptionEn: z.string().nullable(),
  descriptionBn: z.string().nullable(),
  image: mediaRef,
  icon: mediaRef,
  banner: mediaRef,
  chipColor: z.string().nullable(),
  sort: z.number().int(),
  isActive: z.boolean(),
  showOnHome: z.boolean(),
  returnWindowDays: z.number().int().nullable(),
  seoTitle: z.string().nullable(),
  seoDescription: z.string().nullable(),
  productCount: z.number().int(),
  childCount: z.number().int(),
});

export class CategoryDto extends createZodDto(categorySchema) {}
export class CategoryListDto extends createZodDto(z.array(categorySchema)) {}

export class CategoryDetailDto extends createZodDto(
  categorySchema.extend({
    attributes: z.array(attributeSchema),
    inheritedAttributes: z.array(inheritedAttributeSchema),
  }),
) {}

const categoryFields = {
  nameEn: z.string().trim().min(1).max(150),
  nameBn: z.string().trim().max(150).nullable(),
  slug,
  descriptionEn: z.string().trim().max(5000).nullable(),
  descriptionBn: z.string().trim().max(5000).nullable(),
  imageMediaId: z.uuid().nullable(),
  iconMediaId: z.uuid().nullable(),
  bannerMediaId: z.uuid().nullable(),
  chipColor: hexColor.nullable(),
  sort: z.number().int().min(0).max(1_000_000),
  isActive: z.boolean(),
  showOnHome: z.boolean(),
  returnWindowDays: z.number().int().min(0).max(365).nullable(),
  seoTitle: z.string().trim().max(200).nullable(),
  seoDescription: z.string().trim().max(500).nullable(),
};

export class CreateCategoryDto extends createZodDto(
  z.object({
    parentId: z.uuid().nullish(),
    nameEn: categoryFields.nameEn,
    nameBn: categoryFields.nameBn.optional(),
    slug: categoryFields.slug.optional(),
    descriptionEn: categoryFields.descriptionEn.optional(),
    descriptionBn: categoryFields.descriptionBn.optional(),
    imageMediaId: categoryFields.imageMediaId.optional(),
    iconMediaId: categoryFields.iconMediaId.optional(),
    bannerMediaId: categoryFields.bannerMediaId.optional(),
    chipColor: categoryFields.chipColor.optional(),
    sort: categoryFields.sort.optional(),
    isActive: categoryFields.isActive.optional(),
    showOnHome: categoryFields.showOnHome.optional(),
    returnWindowDays: categoryFields.returnWindowDays.optional(),
    seoTitle: categoryFields.seoTitle.optional(),
    seoDescription: categoryFields.seoDescription.optional(),
  }),
) {}

export class UpdateCategoryDto extends createZodDto(
  z.object({
    /** Set to move the category (and its sub-tree); null makes it a main category. */
    parentId: z.uuid().nullable().optional(),
    nameEn: categoryFields.nameEn.optional(),
    nameBn: categoryFields.nameBn.optional(),
    slug: categoryFields.slug.optional(),
    descriptionEn: categoryFields.descriptionEn.optional(),
    descriptionBn: categoryFields.descriptionBn.optional(),
    imageMediaId: categoryFields.imageMediaId.optional(),
    iconMediaId: categoryFields.iconMediaId.optional(),
    bannerMediaId: categoryFields.bannerMediaId.optional(),
    chipColor: categoryFields.chipColor.optional(),
    sort: categoryFields.sort.optional(),
    isActive: categoryFields.isActive.optional(),
    showOnHome: categoryFields.showOnHome.optional(),
    returnWindowDays: categoryFields.returnWindowDays.optional(),
    seoTitle: categoryFields.seoTitle.optional(),
    seoDescription: categoryFields.seoDescription.optional(),
  }),
) {}

export class ReorderDto extends createZodDto(
  z
    .array(z.object({ id: z.uuid(), sort: z.number().int().min(0).max(1_000_000) }))
    .min(1)
    .max(500),
) {}

export class DeleteCategoryDto extends createZodDto(
  // targetId may be left out in "move" mode when the category is empty (nothing to move).
  z.object({ mode: z.enum(['move', 'cascade']), targetId: z.uuid().optional() }),
) {}

export class DeletePreviewDto extends createZodDto(
  z.object({
    subCategoryCount: z.number().int(),
    productCount: z.number().int(),
    primaryProductCount: z.number().int(),
  }),
) {}

export class AttributeDto extends createZodDto(attributeSchema) {}

const attributeFields = {
  nameEn: z.string().trim().min(1).max(100),
  nameBn: z.string().trim().max(100).nullable(),
  type: attributeTypeSchema,
  unit: z.string().trim().max(20).nullable(),
  isFilterable: z.boolean(),
  isRequired: z.boolean(),
  sort: z.number().int().min(0).max(1_000_000),
};

export class CreateAttributeDto extends createZodDto(
  z.object({
    key: z
      .string()
      .trim()
      .min(1)
      .max(40)
      .regex(/^[a-z][a-z0-9_]*$/, 'snake_case: lowercase letters, digits, underscores'),
    nameEn: attributeFields.nameEn,
    nameBn: attributeFields.nameBn.optional(),
    type: attributeFields.type,
    unit: attributeFields.unit.optional(),
    isFilterable: attributeFields.isFilterable.optional(),
    isRequired: attributeFields.isRequired.optional(),
    sort: attributeFields.sort.optional(),
  }),
) {}

/** The key is fixed once created (imports and product values refer to it). */
export class UpdateAttributeDto extends createZodDto(
  z.object({
    nameEn: attributeFields.nameEn.optional(),
    nameBn: attributeFields.nameBn.optional(),
    type: attributeFields.type.optional(),
    unit: attributeFields.unit.optional(),
    isFilterable: attributeFields.isFilterable.optional(),
    isRequired: attributeFields.isRequired.optional(),
    sort: attributeFields.sort.optional(),
  }),
) {}

export class SetOptionsDto extends createZodDto(
  z
    .array(
      z.object({
        id: z.uuid().optional(),
        valueEn: z.string().max(200),
        valueBn: z.string().max(200).nullish(),
      }),
    )
    .max(500),
) {}

export class OptionListDto extends createZodDto(z.array(optionSchema)) {}

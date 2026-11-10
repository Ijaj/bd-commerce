import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const MAX_BODY = 200 * 1024;

const rowSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  titleEn: z.string(),
  titleBn: z.string().nullable(),
  isPublished: z.boolean(),
  showInFooter: z.boolean(),
  sortOrder: z.number().int(),
  updatedAt: z.iso.datetime(),
});

const fullSchema = rowSchema.extend({
  bodyHtmlEn: z.string().nullable(),
  bodyHtmlBn: z.string().nullable(),
  seoTitle: z.string().nullable(),
  seoDescription: z.string().nullable(),
  createdAt: z.iso.datetime(),
});

export type PageRowView = z.infer<typeof rowSchema>;
export type PageFullView = z.infer<typeof fullSchema>;
export class PageRowDto extends createZodDto(rowSchema) {}
export class PageFullDto extends createZodDto(fullSchema) {}
export class PageListDto extends createZodDto(z.object({ items: z.array(rowSchema) })) {}

const body = z.string().max(MAX_BODY);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((v) => v || null);

const fields = {
  slug: z
    .string()
    .trim()
    .max(60)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Use lowercase letters, digits and single hyphens'),
  titleEn: z.string().trim().min(1).max(120),
  titleBn: optionalText(120),
  bodyHtmlEn: body.nullable(),
  bodyHtmlBn: body.nullable(),
  isPublished: z.boolean(),
  showInFooter: z.boolean(),
  sortOrder: z.number().int().min(0).max(9999),
  seoTitle: optionalText(120),
  seoDescription: optionalText(300),
};

export class PageCreateDto extends createZodDto(
  z.object({
    slug: fields.slug,
    titleEn: fields.titleEn,
    titleBn: fields.titleBn.optional(),
    bodyHtmlEn: fields.bodyHtmlEn.optional(),
    bodyHtmlBn: fields.bodyHtmlBn.optional(),
    isPublished: fields.isPublished.optional(),
    showInFooter: fields.showInFooter.optional(),
    sortOrder: fields.sortOrder.optional(),
    seoTitle: fields.seoTitle.optional(),
    seoDescription: fields.seoDescription.optional(),
  }),
) {}

export class PageUpdateDto extends createZodDto(z.object(fields).partial().strict()) {}

const publicListSchema = z.object({
  items: z.array(
    z.object({ slug: z.string(), titleEn: z.string(), titleBn: z.string().nullable() }),
  ),
});
const publicPageSchema = z.object({
  slug: z.string(),
  titleEn: z.string(),
  titleBn: z.string().nullable(),
  bodyHtmlEn: z.string().nullable(),
  bodyHtmlBn: z.string().nullable(),
  seoTitle: z.string().nullable(),
  seoDescription: z.string().nullable(),
  updatedAt: z.iso.datetime(),
});

export type PublicPageListView = z.infer<typeof publicListSchema>;
export type PublicPageView = z.infer<typeof publicPageSchema>;
export class PublicPageListDto extends createZodDto(publicListSchema) {}
export class PublicPageDto extends createZodDto(publicPageSchema) {}

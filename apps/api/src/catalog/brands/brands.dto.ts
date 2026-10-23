import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { slugSchemaPattern } from '../products/slug';

const brandSchema = z.object({
  id: z.uuid(),
  nameEn: z.string(),
  nameBn: z.string().nullable(),
  slug: z.string(),
  logoMediaId: z.uuid().nullable(),
  /** imgproxy 200x200 */
  logoUrl: z.string().nullable(),
  active: z.boolean(),
  productCount: z.number().int(),
  createdAt: z.iso.datetime(),
});

export type BrandView = z.infer<typeof brandSchema>;
export class BrandDto extends createZodDto(brandSchema) {}
export class BrandListDto extends createZodDto(z.array(brandSchema)) {}

const slug = z.string().trim().toLowerCase().max(100).regex(slugSchemaPattern);

export class CreateBrandDto extends createZodDto(
  z.object({
    nameEn: z.string().trim().min(1).max(100),
    nameBn: z.string().trim().max(100).nullable().optional(),
    slug: slug.optional(),
    logoMediaId: z.uuid().nullable().optional(),
    active: z.boolean().optional(),
  }),
) {}

export class UpdateBrandDto extends createZodDto(
  z.object({
    nameEn: z.string().trim().min(1).max(100).optional(),
    nameBn: z.string().trim().max(100).nullable().optional(),
    slug: slug.optional(),
    logoMediaId: z.uuid().nullable().optional(),
    active: z.boolean().optional(),
  }),
) {}

export class DeleteBrandQueryDto extends createZodDto(
  z.object({ force: z.enum(['true', 'false']).optional() }),
) {}

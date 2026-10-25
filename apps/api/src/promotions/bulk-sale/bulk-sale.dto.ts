import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const page = z.coerce.number().int().min(1).default(1);
const ids = z.array(z.uuid()).max(500).optional();

const baseBody = z.object({
  mode: z.enum(['percent', 'fixed']),
  /** Basis points for percent (1..9999), paisa for fixed. */
  value: z.number().int().min(1).max(100_000_000),
  scope: z.object({ productIds: ids, categoryIds: ids, brandIds: ids }),
  startsAt: z.iso.datetime().nullable().optional(),
  endsAt: z.iso.datetime().nullable().optional(),
  skipExistingSales: z.boolean().optional(),
});

type Body = z.infer<typeof baseBody>;

function check(b: Body, ctx: z.RefinementCtx) {
  const s = b.scope;
  if (!s.productIds?.length && !s.categoryIds?.length && !s.brandIds?.length) {
    ctx.addIssue({
      code: 'custom',
      path: ['scope'],
      message: 'Pick at least one product, category or brand',
    });
  }
  if (b.mode === 'percent' && b.value >= 10_000) {
    ctx.addIssue({ code: 'custom', path: ['value'], message: 'Percent must be below 100%' });
  }
  if (b.startsAt && b.endsAt && Date.parse(b.endsAt) <= Date.parse(b.startsAt)) {
    ctx.addIssue({ code: 'custom', path: ['endsAt'], message: 'endsAt must be after startsAt' });
  }
}

export class BulkSalePreviewDto extends createZodDto(baseBody.superRefine(check)) {}

export class BulkSaleCreateDto extends createZodDto(
  baseBody.extend({ name: z.string().trim().min(1).max(120) }).superRefine(check),
) {}

export class BulkSaleListQueryDto extends createZodDto(
  z.object({ page, pageSize: z.coerce.number().int().min(1).max(100).default(20) }),
) {}

export class BulkSaleItemsQueryDto extends createZodDto(
  z.object({ page, pageSize: z.coerce.number().int().min(1).max(200).default(50) }),
) {}

const batch = z.object({
  id: z.uuid(),
  name: z.string(),
  mode: z.enum(['percent', 'fixed']),
  value: z.number().int(),
  scope: z.object({
    productIds: z.array(z.string()),
    categoryIds: z.array(z.string()),
    brandIds: z.array(z.string()),
  }),
  startsAt: z.string().nullable(),
  endsAt: z.string().nullable(),
  createdAt: z.string(),
  createdByName: z.string().nullable(),
  undoneAt: z.string().nullable(),
  itemCount: z.number().int(),
});

export class BulkSalePreviewResultDto extends createZodDto(
  z.object({
    count: z.number().int(),
    skipped: z.number().int(),
    skippedExisting: z.number().int(),
    skippedPrice: z.number().int(),
    /** True when more than `limit` variants match: apply would be refused. */
    tooMany: z.boolean(),
    limit: z.number().int(),
    sample: z.array(
      z.object({
        variantId: z.uuid(),
        sku: z.string(),
        title: z.string(),
        priceP: z.number().int(),
        currentSalePriceP: z.number().int().nullable(),
        newSalePriceP: z.number().int(),
      }),
    ),
  }),
) {}

export class BulkSaleBatchDto extends createZodDto(batch) {}

export class BulkSaleListDto extends createZodDto(
  z.object({
    items: z.array(batch),
    total: z.number().int(),
    page: z.number().int(),
    pageSize: z.number().int(),
  }),
) {}

export class BulkSaleDetailDto extends createZodDto(
  batch.extend({
    items: z.array(
      z.object({
        variantId: z.uuid(),
        sku: z.string(),
        title: z.string(),
        priceP: z.number().int(),
        prevSalePriceP: z.number().int().nullable(),
        newSalePriceP: z.number().int(),
      }),
    ),
    total: z.number().int(),
    page: z.number().int(),
    pageSize: z.number().int(),
  }),
) {}

export class BulkSaleUndoResultDto extends createZodDto(
  z.object({ restored: z.number().int(), skippedChanged: z.number().int() }),
) {}

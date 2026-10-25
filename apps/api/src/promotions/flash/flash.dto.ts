import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { productCardSchema } from '../../storefront/public.dto';

const page = z.coerce.number().int().min(1).default(1);
const phase = z.enum(['scheduled', 'live', 'ended', 'inactive']);

// ---- admin input ----------------------------------------------------------------------------

const saleFields = {
  nameEn: z.string().trim().min(1).max(120),
  nameBn: z.string().trim().max(120).nullable().optional(),
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime(),
  isActive: z.boolean().optional(),
};

export class FlashSaleCreateDto extends createZodDto(
  z.object(saleFields).refine((b) => Date.parse(b.endsAt) > Date.parse(b.startsAt), {
    message: 'endsAt must be after startsAt',
    path: ['endsAt'],
  }),
) {}

export class FlashSaleUpdateDto extends createZodDto(
  z
    .object({
      nameEn: saleFields.nameEn,
      nameBn: saleFields.nameBn,
      startsAt: saleFields.startsAt,
      endsAt: saleFields.endsAt,
      isActive: z.boolean(),
    })
    .partial(),
) {}

export class FlashSaleListQueryDto extends createZodDto(
  z.object({
    page,
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    phase: phase.optional(),
    q: z.string().trim().max(120).optional(),
  }),
) {}

export class FlashItemsReplaceDto extends createZodDto(
  z.object({
    items: z
      .array(
        z.object({
          variantId: z.uuid(),
          flashPriceP: z.number().int().min(1).max(100_000_000),
          qtyLimit: z.number().int().min(1).max(1_000_000),
          perCustomerLimit: z.number().int().min(1).max(1_000_000).nullable().default(null),
          sort: z.number().int().min(0).max(10_000).default(0),
        }),
      )
      .max(500),
  }),
) {}

// ---- admin output ---------------------------------------------------------------------------

const adminItem = z.object({
  id: z.uuid(),
  variantId: z.uuid(),
  productId: z.uuid(),
  productTitleEn: z.string(),
  sku: z.string(),
  /** Regular variant price. */
  priceP: z.number().int(),
  /** Ordinary sale price in effect now, if any. */
  currentSalePriceP: z.number().int().nullable(),
  flashPriceP: z.number().int(),
  qtyLimit: z.number().int(),
  qtySold: z.number().int(),
  perCustomerLimit: z.number().int().nullable(),
  sort: z.number().int(),
});

const adminSale = z.object({
  id: z.uuid(),
  nameEn: z.string(),
  nameBn: z.string().nullable(),
  startsAt: z.string(),
  endsAt: z.string(),
  isActive: z.boolean(),
  phase,
  itemCount: z.number().int(),
  unitsSold: z.number().int(),
});

export class FlashSaleDetailDto extends createZodDto(
  adminSale.extend({ items: z.array(adminItem) }),
) {}

export class FlashSaleListDto extends createZodDto(
  z.object({
    items: z.array(adminSale),
    total: z.number().int(),
    page: z.number().int(),
    pageSize: z.number().int(),
  }),
) {}

// ---- public ---------------------------------------------------------------------------------

const publicSale = z.object({
  id: z.uuid(),
  nameEn: z.string(),
  nameBn: z.string().nullable(),
  startsAt: z.string(),
  endsAt: z.string(),
  items: z.array(
    z.object({
      variantId: z.uuid(),
      productCard: productCardSchema,
      flashPriceP: z.number().int(),
      remaining: z.number().int(),
      qtyLimit: z.number().int(),
    }),
  ),
});

export class FlashPublicDto extends createZodDto(
  z.object({ live: z.array(publicSale), upcoming: z.array(publicSale) }),
) {}

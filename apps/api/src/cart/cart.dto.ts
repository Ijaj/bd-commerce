import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const imageSet = z.object({
  alt: z.string().nullable(),
  width: z.number(),
  height: z.number(),
  url320: z.string(),
  url640: z.string(),
  url1200: z.string(),
});

export const cartLineSchema = z.object({
  variantId: z.string(),
  productId: z.string(),
  slug: z.string(),
  titleEn: z.string(),
  titleBn: z.string().nullable(),
  optionsTextEn: z.string().nullable(),
  optionsTextBn: z.string().nullable(),
  image: imageSet.nullable(),
  qty: z.number().int(),
  unitPriceP: z.number().int(),
  compareAtP: z.number().int().nullable(),
  priceAtAddP: z.number().int(),
  priceChanged: z.boolean(),
  /// Units that can be bought now (stock minus reservations).
  available: z.number().int(),
  /// Highest qty this line may have: min(available, checkout.maxQtyPerLine).
  maxQty: z.number().int(),
  problem: z.enum(['out_of_stock', 'qty_reduced', 'unavailable', 'upcoming']).nullable(),
});

export class CartDto extends createZodDto(
  z.object({
    items: z.array(cartLineSchema),
    /// Total units in the cart (all lines).
    count: z.number().int(),
    /// Sum of qty × unit price over lines without a problem.
    subtotalP: z.number().int(),
  }),
) {}

export class CartSetQtyDto extends createZodDto(
  z.object({ qty: z.number().int().min(0).max(999) }),
) {}

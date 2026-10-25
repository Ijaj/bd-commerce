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
  /// ISO end time while the line is at flash price (countdown); null otherwise.
  flashEndsAt: z.string().nullable(),
  /// Coupon discount allocated to this line.
  discountP: z.number().int(),
});

const rejectReason = z.enum([
  'NOT_FOUND',
  'INACTIVE',
  'NOT_STARTED',
  'EXPIRED',
  'MIN_ORDER',
  'MIN_QTY',
  'NO_MATCHING_ITEMS',
  'SEGMENT',
  'LIMIT_REACHED',
  'BUDGET_REACHED',
  'PLATFORM',
  'PAYMENT_METHOD',
  'ZONE',
  'NOT_STACKABLE',
  'ONLY_REGULAR_PRICE',
  'ALREADY_USED',
  'LOGIN_REQUIRED',
]);

export const appliedCouponSchema = z.object({
  couponId: z.string(),
  name: z.string(),
  kind: z.enum(['code', 'auto']),
  type: z.enum(['percent', 'fixed', 'free_delivery', 'bxgy', 'tiered', 'bundle']),
  code: z.string().nullable(),
  /// Item plus delivery discount this coupon gives.
  amountP: z.number().int(),
  freeDelivery: z.boolean(),
});

export class CartDto extends createZodDto(
  z.object({
    items: z.array(cartLineSchema),
    /// Total units in the cart (all lines).
    count: z.number().int(),
    /// Sum of qty × unit price over lines without a problem.
    subtotalP: z.number().int(),
    /// Auto and code item discounts together (delivery discounts are priced at checkout).
    discountP: z.number().int(),
    appliedCoupons: z.array(appliedCouponSchema),
    /// Codes still in the cart.
    codes: z.array(z.string()),
    /// Codes dropped from the cart on this read, with the reason.
    rejectedCodes: z.array(z.object({ code: z.string(), reason: rejectReason })),
  }),
) {}

export class CartCouponCodeDto extends createZodDto(
  z.object({
    code: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .regex(/^[A-Za-z0-9_-]+$/, 'Letters, digits, - and _ only'),
  }),
) {}

export class CartCouponSuggestionsDto extends createZodDto(
  z.object({
    items: z.array(
      z.object({
        couponId: z.string(),
        name: z.string(),
        code: z.string().nullable(),
        savingP: z.number().int(),
        source: z.enum(['wallet', 'public']),
      }),
    ),
  }),
) {}

export class CartSetQtyDto extends createZodDto(
  z.object({ qty: z.number().int().min(0).max(999) }),
) {}

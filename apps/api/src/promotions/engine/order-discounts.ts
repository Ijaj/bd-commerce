import { z } from 'zod';
import type { OrderDiscountSnapshot } from '../types';

/** One row of orders.discounts_json as the order APIs return it. */
export const orderDiscountSchema = z.object({
  couponId: z.string(),
  name: z.string(),
  kind: z.enum(['code', 'auto']),
  type: z.enum(['percent', 'fixed', 'free_delivery', 'bxgy', 'tiered', 'bundle']),
  code: z.string().nullable(),
  /// Item discount this coupon gave.
  amountP: z.number().int(),
  /// Delivery discount this coupon gave.
  deliveryP: z.number().int(),
});

/** The column is Json: old rows hold `[]`, so anything unexpected reads as no discounts. */
export function readDiscounts(json: unknown): OrderDiscountSnapshot[] {
  const parsed = z.array(orderDiscountSchema).safeParse(json);
  return parsed.success ? parsed.data : [];
}

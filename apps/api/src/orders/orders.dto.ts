import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { orderDiscountSchema } from '../promotions/engine/order-discounts';

const imageSet = z.object({
  alt: z.string().nullable(),
  width: z.number(),
  height: z.number(),
  url320: z.string(),
  url640: z.string(),
  url1200: z.string(),
});

const orderStatus = z.enum([
  'pending_payment',
  'processing',
  'on_hold',
  'partially_shipped',
  'shipped',
  'delivered',
  'completed',
  'cancelled',
]);

export class OrderListQueryDto extends createZodDto(
  z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
  }),
) {}

export class OrderListDto extends createZodDto(
  z.object({
    items: z.array(
      z.object({
        orderNo: z.string(),
        placedAt: z.string(),
        status: orderStatus,
        grandTotalP: z.number(),
        itemCount: z.number(),
        firstImage: imageSet.nullable(),
      }),
    ),
    total: z.number(),
    page: z.number(),
    limit: z.number(),
  }),
) {}

const timeline = z.array(z.object({ status: orderStatus, at: z.string() }));

export class OrderDetailDto extends createZodDto(
  z.object({
    orderNo: z.string(),
    placedAt: z.string(),
    status: orderStatus,
    paymentStatus: z.string(),
    paymentMethod: z.string(),
    lang: z.enum(['en', 'bn']),
    isPreorder: z.boolean(),
    customerNote: z.string().nullable(),
    items: z.array(
      z.object({
        orderItemId: z.string(),
        returnableQty: z.number(),
        productId: z.string(),
        variantId: z.string(),
        slug: z.string(),
        title: z.string(),
        sku: z.string(),
        optionsText: z.string().nullable(),
        image: imageSet.nullable(),
        qty: z.number(),
        qtyCancelled: z.number(),
        unitPriceP: z.number(),
        lineTotalP: z.number(),
        /// Coupon discount allocated to this line (lineTotalP is before it).
        discountP: z.number(),
      }),
    ),
    /// Coupons applied to the order, as snapshotted at checkout.
    discounts: z.array(orderDiscountSchema),
    money: z.object({
      subtotalP: z.number(),
      autoDiscountP: z.number(),
      couponDiscountP: z.number(),
      deliveryChargeP: z.number(),
      deliveryDiscountP: z.number(),
      grandTotalP: z.number(),
      paidP: z.number(),
      refundedP: z.number(),
      codDueP: z.number(),
    }),
    shipTo: z.object({
      name: z.string(),
      phone: z.string(),
      placeText: z.string(),
      line: z.string(),
      landmark: z.string().nullable(),
    }),
    zone: z.object({
      nameEn: z.string(),
      nameBn: z.string().nullable(),
      etaMinDays: z.number(),
      etaMaxDays: z.number(),
    }),
    history: timeline,
  }),
) {}

export class OrderTrackRequestDto extends createZodDto(
  z.object({ orderNo: z.string().trim().min(3).max(20), phone: z.string().trim().min(5).max(30) }),
) {}

export class OrderTrackDto extends createZodDto(
  z.object({
    orderNo: z.string(),
    status: orderStatus,
    placedAt: z.string(),
    maskedPhone: z.string(),
    itemCount: z.number(),
    grandTotalP: z.number(),
    etaMinDays: z.number(),
    etaMaxDays: z.number(),
    timeline,
  }),
) {}

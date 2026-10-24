import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const location = {
  districtId: z.number().int(),
  upazilaId: z.number().int(),
  areaId: z.number().int().nullish(),
};

export class CheckoutQuoteRequestDto extends createZodDto(z.object(location)) {}

export class CheckoutQuoteDto extends createZodDto(
  z.object({
    zone: z.object({
      id: z.string(),
      nameEn: z.string(),
      nameBn: z.string().nullable(),
      etaMinDays: z.number(),
      etaMaxDays: z.number(),
    }),
    subtotalP: z.number(),
    deliveryChargeP: z.number(),
    deliveryDiscountP: z.number(),
    grandTotalP: z.number(),
    freeDeliveryRemainingP: z.number().nullable(),
    guestOtpRequired: z.boolean(),
    problems: z.array(z.enum(['CART_EMPTY', 'CART_CHANGED', 'OUT_OF_STOCK'])),
  }),
) {}

export class CheckoutOtpRequestDto extends createZodDto(
  z.object({ phone: z.string().trim().min(5).max(30) }),
) {}

const phone = z.string().trim().min(5).max(30);

export class CheckoutPlaceDto extends createZodDto(
  z
    .object({
      addressId: z.uuid().optional(),
      address: z
        .object({
          name: z.string().trim().min(1).max(100),
          phone,
          ...location,
          line: z.string().trim().min(3).max(300),
          landmark: z.string().trim().max(200).nullish(),
        })
        .optional(),
      guest: z
        .object({
          name: z.string().trim().min(1).max(100),
          phone,
          email: z.email().max(254).optional(),
        })
        .optional(),
      otpCode: z
        .string()
        .regex(/^\d{6}$/, '6-digit code')
        .optional(),
      note: z.string().trim().max(500).optional(),
      lang: z.enum(['en', 'bn']),
      idempotencyKey: z.string().trim().min(8).max(100),
    })
    .refine((v) => (v.addressId === undefined) !== (v.address === undefined), {
      message: 'Send either addressId or address',
    }),
) {}

export class CheckoutPlacedDto extends createZodDto(
  z.object({
    orderNo: z.string(),
    orderId: z.string(),
    grandTotalP: z.number(),
    codDueP: z.number(),
  }),
) {}

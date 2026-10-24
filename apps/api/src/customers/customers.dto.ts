import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const password = z.string().min(8).max(256);
const phone = z.string().trim().min(5).max(30);
const otpCode = z.string().regex(/^\d{6}$/, '6-digit code');
const name = z.string().trim().min(1).max(100);
const email = z.email().max(254);

export class RequestOtpDto extends createZodDto(
  z.object({ phone, purpose: z.enum(['signup', 'reset']) }),
) {}

export class OtpSentDto extends createZodDto(
  z.object({ sentTo: z.string(), expiresInSec: z.number(), resendInSec: z.number() }),
) {}

export class SignupDto extends createZodDto(
  z.object({ name, phone, email: email.optional(), password, code: otpCode }),
) {}

export class CustomerLoginDto extends createZodDto(
  z.object({ login: z.string().trim().min(3).max(254), password: z.string().min(1).max(256) }),
) {}

export class ResetPasswordDto extends createZodDto(z.object({ phone, code: otpCode, password })) {}

export class CustomerMeDto extends createZodDto(
  z.object({
    id: z.uuid(),
    name: z.string(),
    phone: z.string().nullable(),
    phoneVerified: z.boolean(),
    email: z.string().nullable(),
    lang: z.enum(['en', 'bn']),
    createdAt: z.string(),
  }),
) {}

export class CustomerAuthResultDto extends createZodDto(
  z.object({ customer: CustomerMeDto.schema }),
) {}

export class UpdateCustomerDto extends createZodDto(
  z.object({
    name: name.optional(),
    email: email.nullable().optional(),
    lang: z.enum(['en', 'bn']).optional(),
  }),
) {}

export class CustomerChangePasswordDto extends createZodDto(
  z.object({ currentPassword: z.string().min(1).max(256), newPassword: password }),
) {}

export class OkDto extends createZodDto(z.object({ ok: z.literal(true) })) {}

const imageSet = z.object({
  alt: z.string().nullable(),
  width: z.number(),
  height: z.number(),
  url320: z.string(),
  url640: z.string(),
  url1200: z.string(),
});

// Same shape as the storefront ProductCard, plus addedAt.
export class WishlistDto extends createZodDto(
  z.object({
    items: z.array(
      z.object({
        id: z.string(),
        slug: z.string(),
        titleEn: z.string(),
        titleBn: z.string().nullable(),
        image: imageSet.nullable(),
        priceP: z.number(),
        compareAtP: z.number().nullable(),
        discountPct: z.number().nullable(),
        ratingAvg: z.number(),
        ratingCount: z.number(),
        soldCount: z.number(),
        badges: z.object({
          isNew: z.boolean(),
          isPreorder: z.boolean(),
          isUpcoming: z.boolean(),
          outOfStock: z.boolean(),
        }),
        addedAt: z.string(),
      }),
    ),
  }),
) {}

export class WishlistIdsDto extends createZodDto(z.object({ productIds: z.array(z.string()) })) {}

export class CustomerErrorDto extends createZodDto(
  z.object({ statusCode: z.number(), message: z.string(), code: z.string().optional() }),
) {}

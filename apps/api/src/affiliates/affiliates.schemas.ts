import { z } from 'zod';
import { normalizePhone } from '../customers/phone';

export const CODE_RE = /^[A-Z0-9]{4,16}$/;

const text = (max: number) => z.string().trim().max(max);

export const page = z.coerce.number().int().min(1).default(1);
export const pageSize = z.coerce.number().int().min(1).max(100).default(20);
export const iso = z.string();

export const commissionStatus = z.enum(['pending', 'approved', 'reversed', 'paid']);
export const attribution = z.enum(['link', 'code']);
export const affiliateStatus = z.enum(['active', 'suspended']);

/** What the buyer sees for a typed code: never the affiliate's identity beyond the page name. */
export const affiliateRefSchema = z.object({ code: z.string(), displayName: z.string() });

export const bkashDetails = z.object({
  method: z.literal('bkash'),
  // Normalised to 01XXXXXXXXX by the service.
  bkashNumber: text(30).refine(
    (v) => normalizePhone(v) !== null,
    'A valid mobile number is needed',
  ),
  holderName: text(100).min(2),
});

export const bankDetails = z.object({
  method: z.literal('bank'),
  bankName: text(100).min(2),
  branch: text(100).min(2),
  accountNo: text(20).regex(/^\d{6,20}$/, '6 to 20 digits'),
  accountName: text(100).min(2),
});

export const payoutDetailsInput = z.discriminatedUnion('method', [bkashDetails, bankDetails]);
export type PayoutDetails = z.infer<typeof payoutDetailsInput>;

/** Output side of the same shape (the transform above is input only). */
export const payoutDetailsOutput = z.discriminatedUnion('method', [
  z.object({ method: z.literal('bkash'), bkashNumber: z.string(), holderName: z.string() }),
  z.object({
    method: z.literal('bank'),
    bankName: z.string(),
    branch: z.string(),
    accountNo: z.string(),
    accountName: z.string(),
  }),
]);

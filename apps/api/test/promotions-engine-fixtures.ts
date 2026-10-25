import type { INestApplication } from '@nestjs/common';
import type request from 'supertest';
import type { Prisma } from '../src/generated/prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { places, resetCommerce } from './cart-fixtures';

export type Agent = ReturnType<typeof request.agent>;

/** Shared reset: commerce tables plus every step-6 table this agent's tests touch. */
export async function resetPromos(app: INestApplication) {
  await resetCommerce(app);
  await app
    .get(PrismaService)
    .$executeRawUnsafe('TRUNCATE coupons, flash_sales, sale_batches CASCADE');
}

let n = 0;

/** A coupon row with sane defaults (active code coupon, 10% off); override anything. */
export function makeCoupon(
  app: INestApplication,
  o: Partial<Prisma.CouponUncheckedCreateInput> & {
    targets?: { targetType: string; targetId: string; mode: string }[];
    zoneIds?: string[];
    customerIds?: string[];
    tiers?: { minSpendP: number; discountP: number }[];
  } = {},
) {
  const { targets, zoneIds, customerIds, tiers, ...rest } = o;
  const kind = rest.kind ?? 'code';
  n += 1;
  return app.get(PrismaService).coupon.create({
    data: {
      name: `Coupon ${n}`,
      kind,
      code: kind === 'code' && !rest.isBulk ? `CODE${n}` : null,
      type: 'percent',
      value: 1000,
      status: 'active',
      ...rest,
      targets: targets ? { create: targets } : undefined,
      zones: zoneIds ? { create: zoneIds.map((zoneId) => ({ zoneId })) } : undefined,
      customers: customerIds
        ? { create: customerIds.map((customerId) => ({ customerId })) }
        : undefined,
      tiers: tiers ? { create: tiers } : undefined,
    },
  });
}

export async function makeFlash(
  app: INestApplication,
  variantId: string,
  o: { flashPriceP: number; qtyLimit?: number; perCustomerLimit?: number | null; qtySold?: number },
) {
  const now = Date.now();
  const sale = await app.get(PrismaService).flashSale.create({
    data: {
      nameEn: 'Flash',
      startsAt: new Date(now - 3600_000),
      endsAt: new Date(now + 3600_000),
      items: {
        create: {
          variantId,
          flashPriceP: o.flashPriceP,
          qtyLimit: o.qtyLimit ?? 5,
          qtySold: o.qtySold ?? 0,
          perCustomerLimit: o.perCustomerLimit ?? null,
        },
      },
    },
    include: { items: true },
  });
  return { sale, item: sale.items[0] as (typeof sale.items)[number] };
}

let keyN = 0;
export const idemKey = () => `promo-key-${Date.now()}-${keyN++}`;

export async function dhakaAddress(app: INestApplication) {
  const p = await places(app);
  return { name: 'Karim', phone: '01811111111', ...p.dhaka, line: 'House 1, Road 2' };
}

export async function placeAs(
  app: INestApplication,
  a: Agent,
  o: { guestPhone?: string | null; body?: Record<string, unknown> } = {},
) {
  const guestPhone = o.guestPhone === undefined ? '01811111111' : o.guestPhone;
  return a.post('/v1/checkout/place').send({
    address: await dhakaAddress(app),
    ...(guestPhone ? { guest: { name: 'Karim', phone: guestPhone } } : {}),
    lang: 'en',
    idempotencyKey: idemKey(),
    ...o.body,
  });
}

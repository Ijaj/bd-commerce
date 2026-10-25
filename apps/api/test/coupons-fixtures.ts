import type { INestApplication } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service';

let orderSeq = 0;

/** Order straight in the DB (enough columns for redemption/report tests). */
export async function makeOrder(
  app: INestApplication,
  o: { customerId?: string | null; grandTotalP?: number; guestPhone?: string } = {},
) {
  const prisma = app.get(PrismaService);
  const zone = await prisma.deliveryZone.findFirstOrThrow();
  orderSeq += 1;
  return prisma.order.create({
    data: {
      orderNo: `2610-7${String(orderSeq).padStart(4, '0')}${Math.floor(Math.random() * 90 + 10)}`,
      customerId: o.customerId ?? null,
      shipName: 'Karim',
      shipPhone: o.guestPhone ?? '01799999999',
      shipDivisionId: 3,
      shipDistrictId: 47,
      shipUpazilaId: 1,
      shipPlaceText: 'Gulshan, Dhaka',
      shipLine: 'Road 1',
      zoneId: zone.id,
      subtotalP: o.grandTotalP ?? 100_000,
      deliveryChargeP: 0,
      grandTotalP: o.grandTotalP ?? 100_000,
      codDueP: o.grandTotalP ?? 100_000,
    },
  });
}

/** Coupon straight in the DB; defaults to a live 10% code coupon. */
export async function dbCoupon(
  app: INestApplication,
  o: Partial<Parameters<PrismaService['coupon']['create']>[0]['data']> = {},
) {
  const prisma = app.get(PrismaService);
  const n = Math.random().toString(36).slice(2, 8).toUpperCase();
  return prisma.coupon.create({
    data: {
      name: `Coupon ${n}`,
      kind: 'code',
      code: `T${n}`,
      type: 'percent',
      value: 1000,
      status: 'active',
      ...o,
    } as never,
  });
}

export const DAY = 86_400_000;
export const inDays = (d: number) => new Date(Date.now() + d * DAY);

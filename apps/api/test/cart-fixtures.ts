import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { expect } from 'vitest';
import { PrismaService } from '../src/prisma/prisma.service';
import { seedDemoZones } from '../src/seed/demo-zones';
import { SmsService } from '../src/sms/sms.service';
import { resetDb } from './helpers';

export const PASSWORD = 'correct horse';

/** Clears step-4 tables on top of the shared reset, then re-seeds the three demo zones. */
export async function resetCommerce(app: INestApplication) {
  await resetDb(app);
  const prisma = app.get(PrismaService);
  await prisma.$executeRawUnsafe(
    'TRUNCATE order_items, order_status_history, payments, orders, cart_items, carts, ' +
      'customer_addresses, zone_locations, delivery_zones, wishlists CASCADE',
  );
  await prisma.customerSession.deleteMany();
  await prisma.otpCode.deleteMany();
  await prisma.customer.deleteMany();
  app.get(SmsService).outbox.length = 0;
  await seedDemoZones(prisma);
}

/** Places that exist in the geo seed: Dhaka city (Gulshan), a suburb (Gazipur Sadar) and a far district. */
export async function places(app: INestApplication) {
  const prisma = app.get(PrismaService);
  const gulshan = await prisma.upazila.findFirstOrThrow({
    where: { nameEn: 'Gulshan', districtId: 47 },
  });
  const savar = await prisma.upazila.findFirstOrThrow({ where: { nameEn: 'Savar' } });
  const gazipur = await prisma.upazila.findFirstOrThrow({ where: { nameEn: 'Gazipur Sadar' } });
  const far = await prisma.upazila.findFirstOrThrow({ where: { districtId: 1 } });
  const loc = (u: { id: number; districtId: number }) => ({
    districtId: u.districtId,
    upazilaId: u.id,
  });
  return { dhaka: loc(gulshan), savar: loc(savar), suburb: loc(gazipur), far: loc(far) };
}

export async function makeProduct(
  app: INestApplication,
  o: {
    priceP?: number;
    stock?: number;
    weightG?: number | null;
    fulfillment?: 'stock' | 'dropship';
    isPreorder?: boolean;
    isUpcoming?: boolean;
    overrideP?: number | null;
    status?: 'active' | 'draft';
    salePriceP?: number | null;
  } = {},
) {
  const prisma = app.get(PrismaService);
  const seller =
    (await prisma.seller.findFirst()) ?? (await prisma.seller.create({ data: { name: 'Shop' } }));
  const cat =
    (await prisma.category.findUnique({ where: { slug: 'cm-cat' } })) ??
    (await prisma.category.create({
      data: { slug: 'cm-cat', nameEn: 'Cat', level: 1, path: '/cm-cat' },
    }));
  const slug = `p-${Math.random().toString(36).slice(2, 9)}`;
  const product = await prisma.product.create({
    data: {
      sellerId: seller.id,
      primaryCategoryId: cat.id,
      titleEn: `Product ${slug}`,
      titleBn: `পণ্য ${slug}`,
      slug,
      status: o.status ?? 'active',
      publishedAt: new Date(Date.now() - 60_000),
      fulfillment: o.fulfillment ?? 'stock',
      weightG: o.weightG === undefined ? 500 : o.weightG,
      isPreorder: o.isPreorder ?? false,
      isUpcoming: o.isUpcoming ?? false,
      deliveryChargeOverrideP: o.overrideP ?? null,
      variants: {
        create: {
          sku: `sku-${slug}`,
          priceP: o.priceP ?? 100_000,
          salePriceP: o.salePriceP ?? null,
          inventory: { create: { onHand: o.stock ?? 10 } },
        },
      },
    },
    include: { variants: true },
  });
  return { product, variant: product.variants[0] as (typeof product.variants)[number] };
}

/** Signs a customer up through the API; the agent keeps the session cookie. */
export async function signupCustomer(
  app: INestApplication,
  agent: ReturnType<typeof request.agent>,
  phone = '01712345678',
  extra: Record<string, unknown> = {},
) {
  const sms = app.get(SmsService);
  await agent.post('/v1/customer/auth/otp').send({ phone, purpose: 'signup' }).expect(200);
  const code = /code: (\d{6})/.exec(sms.outbox.at(-1)?.text ?? '')?.[1] ?? '';
  const res = await agent
    .post('/v1/customer/auth/signup')
    .send({ name: 'Rahim', phone, password: PASSWORD, code, ...extra })
    .expect(200);
  return res.body.customer as { id: string };
}

export function lastOtp(app: INestApplication) {
  return /code: (\d{6})/.exec(app.get(SmsService).outbox.at(-1)?.text ?? '')?.[1] ?? '';
}

export async function addToCart(
  agent: ReturnType<typeof request.agent>,
  variantId: string,
  qty = 1,
) {
  const res = await agent.put(`/v1/cart/items/${variantId}`).send({ qty }).expect(200);
  expect(res.body.items.some((i: { variantId: string }) => i.variantId === variantId)).toBe(true);
  return res.body;
}

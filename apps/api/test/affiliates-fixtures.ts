import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { addToCart, signupCustomer } from './cart-fixtures';
import { placeAs } from './promotions-engine-fixtures';

export type Agent = ReturnType<typeof request.agent>;

let phoneN = 0;
export const nextPhone = () => `0172${String(3_000_000 + ++phoneN).padStart(7, '0')}`;

/** A signed-in customer who joined the program. */
export async function newAffiliate(
  app: INestApplication,
  displayName: string,
  o: { phone?: string; code?: string } = {},
) {
  const agent = request.agent(app.getHttpServer());
  const phone = o.phone ?? nextPhone();
  const customer = await signupCustomer(app, agent, phone);
  const res = await agent
    .post('/v1/customer/affiliate/join')
    .send({ displayName, ...(o.code ? { code: o.code } : {}) });
  return { agent, phone, customer, res, code: res.body.code as string };
}

/** Clicks an affiliate link with a fresh browser; the agent keeps the visitor cookie. */
export function clickAs(agent: Agent, code: string, landingUrl = '/p/x?ref=1') {
  return agent.post('/v1/public/affiliates/click').send({ code, landingUrl });
}

/** Guest browser puts `qty` of the variant in the cart (optionally typing an affiliate/coupon code) and places. */
export async function placeGuest(
  app: INestApplication,
  variantId: string,
  o: { agent?: Agent; code?: string; qty?: number; guestPhone?: string } = {},
) {
  const a = o.agent ?? request.agent(app.getHttpServer());
  await addToCart(a, variantId, o.qty ?? 2);
  if (o.code) await a.post('/v1/cart/coupon').send({ code: o.code }).expect(200);
  const res = await placeAs(app, a, { guestPhone: o.guestPhone ?? nextPhone() });
  return { agent: a, res };
}

export async function orderOf(app: INestApplication, orderNo: string) {
  return app.get(PrismaService).order.findUniqueOrThrow({
    where: { orderNo },
    include: { items: true, affiliateCommission: true },
  });
}

export async function cleanAffiliates(app: INestApplication) {
  await app
    .get(PrismaService)
    .$executeRawUnsafe(
      'TRUNCATE affiliate_payouts, affiliate_commissions, affiliate_clicks, affiliates CASCADE',
    );
}

import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/prisma/prisma.service';
import { cleanAffiliates, clickAs, newAffiliate, orderOf, placeGuest } from './affiliates-fixtures';
import { addToCart, makeProduct, places, signupCustomer } from './cart-fixtures';
import { createApp, createOwner } from './helpers';
import { makeCoupon, placeAs, resetPromos } from './promotions-engine-fixtures';

describe('affiliates: join, codes, clicks, attribution', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let variantId: string;
  let owner: Awaited<ReturnType<typeof createOwner>>;

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
  }, 90_000);
  beforeEach(async () => {
    await cleanAffiliates(app);
    await resetPromos(app);
    owner = await createOwner(app);
    variantId = (await makeProduct(app, { priceP: 100_000, stock: 50 })).variant.id;
  });
  afterAll(async () => {
    await cleanAffiliates(app);
    await app.close();
  });

  const guest = () => request.agent(app.getHttpServer());
  const setProgram = (v: Partial<{ enabled: boolean; clickWindowDays: number }>) =>
    owner.agent
      .put('/v1/admin/settings/affiliates')
      .send({
        value: {
          enabled: true,
          defaultCommissionBp: 500,
          minPayoutP: 50_000,
          clickWindowDays: 30,
          ...v,
        },
      })
      .expect(204);

  describe('join and codes', () => {
    it('derives a code from the page name and returns the profile', async () => {
      const a = await newAffiliate(app, 'Tech Deals BD');
      expect(a.res.status).toBe(201);
      expect(a.res.body).toMatchObject({
        joined: true,
        code: 'TECHDEALSB',
        status: 'active',
        commissionBp: 500,
        payoutMethod: null,
        payoutDetailsMasked: null,
        clickWindowDays: 30,
        minPayoutP: 50_000,
        programEnabled: true,
      });
      const twin = await newAffiliate(app, 'Tech Deals BD');
      expect(twin.code).toMatch(/^TECHDEALSB\d{2,}$/);
      const bangla = await newAffiliate(app, 'আমার পেজ');
      expect(bangla.code).toMatch(/^[A-Z0-9]{4,16}$/);
    });

    it('takes a requested code upper-cased and refuses a taken or malformed one', async () => {
      const a = await newAffiliate(app, 'Alice', { code: 'alice10' });
      expect(a.code).toBe('ALICE10');
      const dup = await newAffiliate(app, 'Bob', { code: 'ALICE10' });
      expect(dup.res.status).toBe(409);
      expect(dup.res.body.code).toBe('AFFILIATE_CODE_TAKEN');
      const bad = await newAffiliate(app, 'Carl', { code: 'a-b' });
      expect(bad.res.status).toBe(400);
    });

    it('refuses a code equal to a coupon code or a bulk code, and the reverse', async () => {
      await makeCoupon(app, { code: 'SAVE10' });
      const t = await newAffiliate(app, 'Dave', { code: 'save10' });
      expect(t.res.body.code).toBe('AFFILIATE_CODE_TAKEN');
      const bulk = await makeCoupon(app, { kind: 'code', isBulk: true, code: null });
      await prisma.couponCode.create({ data: { couponId: bulk.id, code: 'BULK1234' } });
      const t2 = await newAffiliate(app, 'Eve', { code: 'BULK1234' });
      expect(t2.res.body.code).toBe('AFFILIATE_CODE_TAKEN');

      await newAffiliate(app, 'Fay', { code: 'FAYCODE' });
      const body = { name: 'X', kind: 'code', type: 'percent', value: 1000 };
      const clash = await owner.agent
        .post('/v1/admin/coupons')
        .send({ ...body, code: 'faycode' })
        .expect(409);
      expect(clash.body.code).toBe('COUPON_CODE_TAKEN');
      // Bulk generation never produces an affiliate's code (no prefix, so the namespace overlaps).
      const gen = await owner.agent
        .post('/v1/admin/coupons')
        .send({ ...body, code: null, isBulk: true, name: 'bulk' })
        .expect(201);
      await owner.agent
        .post(`/v1/admin/coupons/${gen.body.id}/codes/generate`)
        .send({ count: 5, length: 8 })
        .expect(201);
    });

    it('rejects a second join and a join with the program off; dashboards stay readable', async () => {
      const a = await newAffiliate(app, 'Gina');
      const again = await a.agent
        .post('/v1/customer/affiliate/join')
        .send({ displayName: 'Gina 2' });
      expect(again.status).toBe(409);
      expect(again.body.code).toBe('AFFILIATE_ALREADY_JOINED');

      await setProgram({ enabled: false });
      const late = await newAffiliate(app, 'Hank');
      expect(late.res.status).toBe(409);
      expect(late.res.body.code).toBe('AFFILIATE_PROGRAM_OFF');
      const me = await a.agent.get('/v1/customer/affiliate').expect(200);
      expect(me.body).toMatchObject({ joined: true, programEnabled: false });
      await a.agent.get('/v1/customer/affiliate/stats').expect(200);
    });

    it('is not joined by default and needs a customer session', async () => {
      const a = guest();
      await signupCustomer(app, a, '01711112222');
      expect((await a.get('/v1/customer/affiliate').expect(200)).body).toEqual({
        joined: false,
        commissionBp: 500,
        clickWindowDays: 30,
        minPayoutP: 50000,
        programEnabled: true,
      });
      await guest().get('/v1/customer/affiliate').expect(401);
      await a.get('/v1/customer/affiliate/stats').expect(404);
    });

    it('updates the profile and keeps payout details masked', async () => {
      const a = await newAffiliate(app, 'Ivy');
      await a.agent
        .patch('/v1/customer/affiliate')
        .send({ displayName: 'Ivy Reviews', website: 'https://ivy.example/' })
        .expect(200);
      const bk = await a.agent
        .put('/v1/customer/affiliate/payout-details')
        .send({ method: 'bkash', bkashNumber: '+8801712345566', holderName: 'Ivy' })
        .expect(200);
      expect(bk.body).toMatchObject({
        displayName: 'Ivy Reviews',
        payoutMethod: 'bkash',
        payoutDetailsMasked: '017•••••566',
      });
      expect(JSON.stringify(bk.body)).not.toContain('01712345566');
      const bank = await a.agent
        .put('/v1/customer/affiliate/payout-details')
        .send({
          method: 'bank',
          bankName: 'DBBL',
          branch: 'Gulshan',
          accountNo: '1234567891234',
          accountName: 'Ivy',
        })
        .expect(200);
      expect(bank.body).toMatchObject({ payoutMethod: 'bank', payoutDetailsMasked: '…1234' });
      const row = await prisma.affiliate.findFirstOrThrow();
      expect(row.payoutDetailsEnc).not.toContain('1234567891234');
      await a.agent
        .put('/v1/customer/affiliate/payout-details')
        .send({ method: 'bkash', bkashNumber: '123', holderName: 'Ivy' })
        .expect(400);
      await a.agent
        .put('/v1/customer/affiliate/payout-details')
        .send({ method: 'bank', bankName: 'DBBL' })
        .expect(400);
    });
  });

  describe('clicks', () => {
    it('always answers 204 and records only valid clicks, deduped per visitor for 30 minutes', async () => {
      const a = await newAffiliate(app, 'Jack');
      const v = guest();
      await clickAs(v, a.code).expect(204);
      await clickAs(v, a.code).expect(204);
      expect(await prisma.affiliateClick.count()).toBe(1);
      await clickAs(v, 'NOSUCHCODE').expect(204);
      await clickAs(v, a.code, 'javascript:alert(1)').expect(204);
      expect(await prisma.affiliateClick.count()).toBe(1);
      // Older than 30 minutes counts as a new visit.
      await prisma.affiliateClick.updateMany({
        data: { clickedAt: new Date(Date.now() - 31 * 60_000) },
      });
      await clickAs(v, a.code).expect(204);
      expect(await prisma.affiliateClick.count()).toBe(2);
      // Another affiliate in between is a new click too.
      const b = await newAffiliate(app, 'Kim');
      await clickAs(v, b.code).expect(204);
      expect(await prisma.affiliateClick.count()).toBe(3);
    });

    it('stores utm, ignores suspended affiliates and a program that is off', async () => {
      const a = await newAffiliate(app, 'Liam');
      await guest()
        .post('/v1/public/affiliates/click')
        .send({
          code: a.code.toLowerCase(),
          landingUrl: '/',
          utm: { source: 'fb', campaign: 'eid' },
        })
        .expect(204);
      expect((await prisma.affiliateClick.findFirstOrThrow()).utm).toEqual({
        source: 'fb',
        campaign: 'eid',
      });

      await prisma.affiliate.update({
        where: { id: a.res.body.id },
        data: { status: 'suspended' },
      });
      await clickAs(guest(), a.code).expect(204);
      expect(await prisma.affiliateClick.count()).toBe(1);
      await prisma.affiliate.update({ where: { id: a.res.body.id }, data: { status: 'active' } });
      await setProgram({ enabled: false });
      await clickAs(guest(), a.code).expect(204);
      expect(await prisma.affiliateClick.count()).toBe(1);
    });
  });

  describe('attribution at placement', () => {
    it('credits the last click within the window; a guest order counts', async () => {
      const a = await newAffiliate(app, 'Mia');
      const b = await newAffiliate(app, 'Noor');
      const v = guest();
      await clickAs(v, a.code).expect(204);
      await prisma.affiliateClick.updateMany({
        data: { clickedAt: new Date(Date.now() - 2 * 3600_000) },
      });
      await clickAs(v, b.code).expect(204);
      const { res } = await placeGuest(app, variantId, { agent: v });
      expect(res.status).toBe(200);
      expect(res.body.affiliate).toBeNull();
      const o = await orderOf(app, res.body.orderNo);
      expect(o).toMatchObject({
        affiliateId: b.res.body.id,
        affiliateAttribution: 'link',
        customerId: null,
      });
      expect(o.affiliateCommission).toMatchObject({
        status: 'pending',
        commissionBp: 500,
        baseP: 200_000,
        amountP: 10_000,
      });
    });

    it('ignores clicks outside the window and clicks of suspended affiliates', async () => {
      const a = await newAffiliate(app, 'Omar');
      const v = guest();
      await clickAs(v, a.code).expect(204);
      await prisma.affiliateClick.updateMany({
        data: { clickedAt: new Date(Date.now() - 31 * 86_400_000) },
      });
      const first = await placeGuest(app, variantId, { agent: v });
      expect((await orderOf(app, first.res.body.orderNo)).affiliateId).toBeNull();

      await prisma.affiliateClick.updateMany({ data: { clickedAt: new Date() } });
      await prisma.affiliate.update({
        where: { id: a.res.body.id },
        data: { status: 'suspended' },
      });
      const second = await placeGuest(app, variantId, { agent: v });
      expect((await orderOf(app, second.res.body.orderNo)).affiliateId).toBeNull();
    });

    it('a typed code beats a link, echoes in the cart and quote and place, and does not use a coupon slot', async () => {
      const a = await newAffiliate(app, 'Pia');
      const b = await newAffiliate(app, 'Quin');
      await makeCoupon(app, { code: 'SAVE10', stacksWithOtherCoupons: true });
      await makeCoupon(app, { code: 'SAVE20', stacksWithOtherCoupons: true });
      const v = guest();
      await clickAs(v, a.code).expect(204);
      await addToCart(v, variantId, 2);
      const cart = await v.post('/v1/cart/coupon').send({ code: b.code.toLowerCase() }).expect(200);
      expect(cart.body.affiliate).toEqual({ code: b.code, displayName: 'Quin' });
      expect(cart.body.codes).toEqual([]);
      expect(cart.body.discountP).toBe(0);
      await v.post('/v1/cart/coupon').send({ code: 'SAVE10' }).expect(200);
      const two = await v.post('/v1/cart/coupon').send({ code: 'SAVE20' }).expect(200);
      expect(two.body.codes).toHaveLength(2);
      expect(two.body.affiliate.code).toBe(b.code);

      const p = await places(app);
      const q = await v.post('/v1/checkout/quote').send(p.dhaka).expect(200);
      expect(q.body.affiliate).toEqual({ code: b.code, displayName: 'Quin' });
      const res = await placeAs(app, v, { guestPhone: '01933333333' });
      expect(res.status).toBe(200);
      expect(res.body.affiliate).toEqual({ code: b.code, displayName: 'Quin' });
      const o = await orderOf(app, res.body.orderNo);
      expect(o).toMatchObject({ affiliateId: b.res.body.id, affiliateAttribution: 'code' });
      // The cart is spent, so the code is gone with it.
      expect((await v.get('/v1/cart').expect(200)).body.affiliate).toBeNull();
    });

    it('removes the typed code, replaces the previous one, and hides a suspended code', async () => {
      const a = await newAffiliate(app, 'Ray');
      const b = await newAffiliate(app, 'Sue');
      const v = guest();
      await addToCart(v, variantId, 1);
      await v.post('/v1/cart/coupon').send({ code: a.code }).expect(200);
      const swapped = await v.post('/v1/cart/coupon').send({ code: b.code }).expect(200);
      expect(swapped.body.affiliate.code).toBe(b.code);
      expect((await v.delete('/v1/cart/affiliate-code').expect(200)).body.affiliate).toBeNull();

      await v.post('/v1/cart/coupon').send({ code: b.code }).expect(200);
      await prisma.affiliate.update({
        where: { id: b.res.body.id },
        data: { status: 'suspended' },
      });
      expect((await v.get('/v1/cart').expect(200)).body.affiliate).toBeNull();
      // A suspended code is not accepted any more: it is just an unknown coupon.
      const rejected = await v.post('/v1/cart/coupon').send({ code: b.code }).expect(422);
      expect(rejected.body.code).toBe('COUPON_INVALID');
      const res = await placeAs(app, v, { guestPhone: '01944444444' });
      expect((await orderOf(app, res.body.orderNo)).affiliateId).toBeNull();
    });

    it('refuses the affiliate typing their own code', async () => {
      const a = await newAffiliate(app, 'Tom');
      await addToCart(a.agent, variantId, 1);
      const r = await a.agent.post('/v1/cart/coupon').send({ code: a.code }).expect(422);
      expect(r.body.code).toBe('AFFILIATE_SELF');
    });

    it('gives no attribution on self-referral: same account, same phone, same address', async () => {
      const a = await newAffiliate(app, 'Uma', { phone: '01755550001' });
      const p = await places(app);
      await prisma.customerAddress.create({
        data: {
          customerId: a.customer.id,
          name: 'Uma',
          phone: '01755550001',
          ...p.dhaka,
          line: 'House 1,  Road 2',
        },
      });

      // Same account: a click made by the affiliate's own browser.
      await clickAs(a.agent, a.code).expect(204);
      await addToCart(a.agent, variantId, 1);
      const own = await placeAs(app, a.agent, { guestPhone: null });
      expect(own.status).toBe(200);
      expect((await orderOf(app, own.body.orderNo)).affiliateId).toBeNull();

      // Same phone: a guest order that uses the affiliate's number.
      const v1 = guest();
      await clickAs(v1, a.code).expect(204);
      const byPhone = await placeGuest(app, variantId, { agent: v1, guestPhone: '+8801755550001' });
      expect((await orderOf(app, byPhone.res.body.orderNo)).affiliateId).toBeNull();

      // Same address (case and spacing aside), different phone.
      const v2 = guest();
      await clickAs(v2, a.code).expect(204);
      const byAddress = await placeGuest(app, variantId, { agent: v2 });
      expect((await orderOf(app, byAddress.res.body.orderNo)).affiliateId).toBeNull();
      expect(await prisma.affiliateCommission.count()).toBe(0);

      // A different address still counts.
      const v3 = guest();
      await clickAs(v3, a.code).expect(204);
      await addToCart(v3, variantId, 1);
      const ok = await placeAs(app, v3, {
        guestPhone: '01966660000',
        body: { address: { name: 'K', phone: '01966660000', ...p.dhaka, line: 'Flat 9, Road 7' } },
      });
      expect((await orderOf(app, ok.body.orderNo)).affiliateId).toBe(a.res.body.id);
    });

    it('does nothing while the program is off', async () => {
      const a = await newAffiliate(app, 'Vic');
      const v = guest();
      await clickAs(v, a.code).expect(204);
      await setProgram({ enabled: false });
      await addToCart(v, variantId, 1);
      expect((await v.post('/v1/cart/coupon').send({ code: a.code }).expect(422)).body.code).toBe(
        'COUPON_INVALID',
      );
      const res = await placeAs(app, v, { guestPhone: '01977770000' });
      expect((await orderOf(app, res.body.orderNo)).affiliateId).toBeNull();
    });

    it('bases the commission on item totals after discounts and never on delivery; per-affiliate rate wins', async () => {
      const a = await newAffiliate(app, 'Wes');
      await prisma.affiliate.update({ where: { id: a.res.body.id }, data: { commissionBp: 1000 } });
      await makeCoupon(app, { code: 'TAKE100', type: 'fixed', value: 10_000 });
      const v = guest();
      await addToCart(v, variantId, 2);
      await v.post('/v1/cart/coupon').send({ code: 'TAKE100' }).expect(200);
      await v.post('/v1/cart/coupon').send({ code: a.code }).expect(200);
      const res = await placeAs(app, v, { guestPhone: '01988880000' });
      const o = await orderOf(app, res.body.orderNo);
      expect(o.deliveryChargeP).toBeGreaterThan(0);
      expect(o.affiliateCommission).toMatchObject({
        commissionBp: 1000,
        baseP: 200_000 - 10_000,
        amountP: 19_000,
      });
    });

    it('shows the commission on the admin order detail, and a customer view without buyer identity', async () => {
      const a = await newAffiliate(app, 'Xena');
      const v = guest();
      await clickAs(v, a.code).expect(204);
      const { res } = await placeGuest(app, variantId, { agent: v });
      const detail = await owner.agent.get(`/v1/admin/orders/${res.body.orderId}`).expect(200);
      expect(detail.body.affiliate).toMatchObject({
        code: a.code,
        displayName: 'Xena',
        attribution: 'link',
        commission: { status: 'pending', amountP: 10_000 },
      });
      const mine = await a.agent.get('/v1/customer/affiliate/commissions').expect(200);
      expect(mine.body.total).toBe(1);
      expect(mine.body.items[0]).toMatchObject({
        itemCount: 2,
        attribution: 'link',
        baseP: 200_000,
        commissionBp: 500,
        amountP: 10_000,
        status: 'pending',
      });
      const text = JSON.stringify(mine.body);
      expect(text).not.toContain(res.body.orderNo);
      expect(text).not.toContain('Karim');
      const stats = await a.agent.get('/v1/customer/affiliate/stats?days=7').expect(200);
      expect(stats.body.days).toHaveLength(7);
      expect(stats.body.totals).toMatchObject({
        clicks: 1,
        orders: 1,
        conversionBp: 10_000,
        pendingP: 10_000,
      });
      await a.agent.get('/v1/customer/affiliate/stats?days=3').expect(400);
    });
  });
});

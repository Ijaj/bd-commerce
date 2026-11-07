import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AffiliateCommissionsJobService } from '../src/affiliates/affiliate-commissions-job.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { cleanAffiliates, clickAs, newAffiliate, orderOf, placeGuest } from './affiliates-fixtures';
import { makeProduct } from './cart-fixtures';
import { createApp, createOwner, createStaffWith } from './helpers';
import { resetPromos } from './promotions-engine-fixtures';

const DAY = 86_400_000;

describe('affiliates: commission job, payouts, admin', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let job: AffiliateCommissionsJobService;
  let variantId: string;
  let owner: Awaited<ReturnType<typeof createOwner>>;

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
    job = app.get(AffiliateCommissionsJobService);
  }, 90_000);
  beforeEach(async () => {
    await cleanAffiliates(app);
    await resetPromos(app);
    owner = await createOwner(app);
    // Many orders from one test IP.
    await owner.agent
      .put('/v1/admin/settings/guest_orders')
      .send({ value: { maxOpenPerPhone: 3, dailyCapP: 2_000_000, perIpPerHour: 500 } })
      .expect(204);
    variantId = (await makeProduct(app, { priceP: 100_000, stock: 50 })).variant.id;
  });
  afterAll(async () => {
    await cleanAffiliates(app);
    await app.close();
  });

  const guest = () => request.agent(app.getHttpServer());

  /** An attributed order for affiliate `code`: 2 x ৳1000, 5% => ৳100 commission. */
  async function attributedOrder(code: string) {
    const v = guest();
    await clickAs(v, code).expect(204);
    const { res } = await placeGuest(app, variantId, { agent: v });
    expect(res.status).toBe(200);
    return orderOf(app, res.body.orderNo);
  }

  const deliver = (orderId: string, daysAgo: number) =>
    prisma.order.update({
      where: { id: orderId },
      data: { status: 'delivered', deliveredAt: new Date(Date.now() - daysAgo * DAY) },
    });
  const commission = (orderId: string) =>
    prisma.affiliateCommission.findUniqueOrThrow({ where: { orderId } });

  describe('commission job', () => {
    it('reverses the commission of a cancelled order', async () => {
      const a = await newAffiliate(app, 'Ann');
      const o = await attributedOrder(a.code);
      await prisma.order.update({ where: { id: o.id }, data: { status: 'cancelled' } });
      expect(await job.run()).toMatchObject({ reversed: 1, approved: 0 });
      expect(await commission(o.id)).toMatchObject({
        status: 'reversed',
        reverseReason: 'order_cancelled',
      });
    });

    it('waits for delivery and for the longest return window, then approves the kept amount', async () => {
      const a = await newAffiliate(app, 'Ben');
      const o = await attributedOrder(a.code);
      // Not delivered: nothing happens.
      expect(await job.run()).toMatchObject({ approved: 0, reversed: 0, scheduled: 0 });
      // Delivered 3 days ago, default window 7 days: scheduled, not approved.
      await deliver(o.id, 3);
      expect(await job.run()).toMatchObject({ approved: 0, scheduled: 1 });
      const waiting = await commission(o.id);
      expect(waiting.status).toBe('pending');
      expect(waiting.availableAt?.getTime()).toBeGreaterThan(Date.now());
      // One line has a longer window (14 days): still waiting on day 10.
      await prisma.orderItem.updateMany({
        where: { orderId: o.id },
        data: { returnWindowDays: 14 },
      });
      await prisma.affiliateCommission.update({
        where: { orderId: o.id },
        data: { availableAt: null },
      });
      await deliver(o.id, 10);
      expect(await job.run()).toMatchObject({ approved: 0 });
      await prisma.affiliateCommission.update({
        where: { orderId: o.id },
        data: { availableAt: null },
      });
      await deliver(o.id, 15);
      expect(await job.run()).toMatchObject({ approved: 1 });
      expect(await commission(o.id)).toMatchObject({
        status: 'approved',
        amountP: 10_000,
        baseP: 200_000,
      });
      // Safe to run again.
      expect(await job.run()).toMatchObject({ approved: 0, reversed: 0 });
    });

    it('counts only units kept: a partial return lowers it, a full return reverses it', async () => {
      const a = await newAffiliate(app, 'Cal');
      const half = await attributedOrder(a.code);
      const all = await attributedOrder(a.code);
      for (const o of [half, all]) await deliver(o.id, 20);
      await prisma.orderItem.updateMany({ where: { orderId: half.id }, data: { qtyReturned: 1 } });
      await prisma.orderItem.updateMany({ where: { orderId: all.id }, data: { qtyReturned: 2 } });
      expect(await job.run()).toMatchObject({ approved: 1, reversed: 1 });
      expect(await commission(half.id)).toMatchObject({
        status: 'approved',
        baseP: 100_000,
        amountP: 5_000,
      });
      expect(await commission(all.id)).toMatchObject({
        status: 'reversed',
        reverseReason: 'nothing_kept',
        amountP: 0,
      });
    });

    it('holds back while a return is open and uses the discounted line value', async () => {
      const a = await newAffiliate(app, 'Dee');
      const o = await attributedOrder(a.code);
      await deliver(o.id, 20);
      await prisma.orderItem.updateMany({ where: { orderId: o.id }, data: { discountP: 50_000 } });
      const ret = await prisma.return.create({
        data: { returnNo: `RET-T-${Date.now()}`, orderId: o.id, status: 'received' },
      });
      expect(await job.run()).toMatchObject({ approved: 0 });
      expect((await commission(o.id)).status).toBe('pending');
      await prisma.return.update({ where: { id: ret.id }, data: { status: 'closed' } });
      expect(await job.run()).toMatchObject({ approved: 1 });
      // (200000 - 50000) x 5%
      expect(await commission(o.id)).toMatchObject({ baseP: 150_000, amountP: 7_500 });
    });

    it('keeps running for a suspended affiliate', async () => {
      const a = await newAffiliate(app, 'Eli');
      const o = await attributedOrder(a.code);
      await deliver(o.id, 20);
      await prisma.affiliate.update({
        where: { id: a.res.body.id },
        data: { status: 'suspended' },
      });
      expect(await job.run()).toMatchObject({ approved: 1 });
    });
  });

  describe('payouts', () => {
    /** Approved commission of `n` orders (৳100 each) for the affiliate. */
    async function approved(code: string, n: number) {
      for (let i = 0; i < n; i++) await deliver((await attributedOrder(code)).id, 20);
      await job.run();
    }

    it('lists only affiliates at or above the minimum, with full details for payout staff', async () => {
      const a = await newAffiliate(app, 'Fox');
      const b = await newAffiliate(app, 'Gus');
      await a.agent
        .put('/v1/customer/affiliate/payout-details')
        .send({ method: 'bkash', bkashNumber: '01712345566', holderName: 'Fox' })
        .expect(200);
      await approved(a.code, 5); // ৳500 = the minimum
      await approved(b.code, 4); // ৳400, carries over
      const due = await owner.agent.get('/v1/admin/affiliate-payouts/due').expect(200);
      expect(due.body.items).toEqual([
        {
          affiliateId: a.res.body.id,
          code: a.code,
          displayName: 'Fox',
          balanceP: 50_000,
          commissionCount: 5,
          payoutMethod: 'bkash',
          payoutDetails: { method: 'bkash', bkashNumber: '01712345566', holderName: 'Fox' },
          hasPayoutDetails: true,
        },
      ]);
    });

    it('records a payout in one go: refuses a stale amount, then pays and marks commissions paid', async () => {
      const a = await newAffiliate(app, 'Hal');
      await approved(a.code, 5);
      const url = `/v1/admin/affiliates/${a.res.body.id}/payouts`;
      const body = { method: 'bkash', reference: 'TX123', expectedAmountP: 50_000 };
      const stale = await owner.agent
        .post(url)
        .send({ ...body, expectedAmountP: 40_000 })
        .expect(409);
      expect(stale.body).toMatchObject({
        code: 'AFFILIATE_PAYOUT_CHANGED',
        currentAmountP: 50_000,
      });
      const ok = await owner.agent.post(url).send(body).expect(201);
      expect(ok.body).toMatchObject({
        amountP: 50_000,
        method: 'bkash',
        reference: 'TX123',
        affiliate: { id: a.res.body.id, code: a.code },
        paidBy: { name: 'Owner One' },
      });
      expect(ok.body.period).toMatch(/^\d{4}-\d{2}$/);
      const rows = await prisma.affiliateCommission.findMany();
      expect(rows.every((r) => r.status === 'paid' && r.payoutId === ok.body.id)).toBe(true);
      const again = await owner.agent.post(url).send(body).expect(409);
      expect(again.body.code).toBe('AFFILIATE_NOTHING_DUE');

      const mine = await a.agent.get('/v1/customer/affiliate/payouts').expect(200);
      expect(mine.body).toMatchObject({
        total: 1,
        items: [{ amountP: 50_000, reference: 'TX123' }],
      });
      const stats = await a.agent.get('/v1/customer/affiliate/stats').expect(200);
      expect(stats.body.totals).toMatchObject({ paidP: 50_000, balanceP: 0 });
      const list = await owner.agent
        .get(`/v1/admin/affiliate-payouts?affiliateId=${a.res.body.id}`)
        .expect(200);
      expect(list.body.total).toBe(1);
    });

    it('refuses a balance below the minimum and lets two parallel payouts pay once', async () => {
      const a = await newAffiliate(app, 'Ian');
      await approved(a.code, 2);
      const url = `/v1/admin/affiliates/${a.res.body.id}/payouts`;
      const low = await owner.agent
        .post(url)
        .send({ method: 'cash', reference: 'CASH1', expectedAmountP: 20_000 })
        .expect(409);
      expect(low.body.code).toBe('AFFILIATE_BELOW_MIN');
      await approved(a.code, 3);
      const send = () =>
        owner.agent.post(url).send({ method: 'cash', reference: 'CASH2', expectedAmountP: 50_000 });
      const [x, y] = await Promise.all([send(), send()]);
      expect([x.status, y.status].sort()).toEqual([201, 409]);
      expect(await prisma.affiliatePayout.count()).toBe(1);
    });

    it('can pay a suspended affiliate; the paid-needs-payout CHECK holds', async () => {
      const a = await newAffiliate(app, 'Jo');
      await approved(a.code, 5);
      await owner.agent
        .patch(`/v1/admin/affiliates/${a.res.body.id}`)
        .send({ status: 'suspended', suspendedReason: 'spam' })
        .expect(200);
      await owner.agent
        .post(`/v1/admin/affiliates/${a.res.body.id}/payouts`)
        .send({ method: 'bank', reference: 'BANK1', expectedAmountP: 50_000 })
        .expect(201);
      // A paid commission always keeps its payout.
      await expect(
        prisma.$executeRawUnsafe('UPDATE affiliate_commissions SET payout_id = NULL'),
      ).rejects.toThrow();
    });
  });

  describe('admin', () => {
    it('lists, searches and shows affiliates with money and rate', async () => {
      const a = await newAffiliate(app, 'Kay', { phone: '01766660001' });
      const b = await newAffiliate(app, 'Lou', { phone: '01766660002' });
      await prisma.affiliate.update({ where: { id: b.res.body.id }, data: { commissionBp: 800 } });
      const o = await attributedOrder(a.code);
      await deliver(o.id, 20);
      await job.run();

      const all = await owner.agent.get('/v1/admin/affiliates').expect(200);
      expect(all.body.total).toBe(2);
      const rowA = all.body.items.find((r: { id: string }) => r.id === a.res.body.id);
      expect(rowA).toMatchObject({
        code: a.code,
        customer: { phone: '01766660001' },
        commissionBp: 500,
        rateOverridden: false,
        clicks30: 1,
        orders30: 1,
        pendingP: 0,
        balanceP: 10_000,
        paidP: 0,
      });
      const rowB = all.body.items.find((r: { id: string }) => r.id === b.res.body.id);
      expect(rowB).toMatchObject({ commissionBp: 800, rateOverridden: true });
      const byPhone = await owner.agent.get('/v1/admin/affiliates?q=01766660002').expect(200);
      expect(byPhone.body.items.map((r: { id: string }) => r.id)).toEqual([b.res.body.id]);
      const byName = await owner.agent.get('/v1/admin/affiliates?q=kay&status=active').expect(200);
      expect(byName.body.total).toBe(1);

      const coms = await owner.agent
        .get(`/v1/admin/affiliates/${a.res.body.id}/commissions?status=approved`)
        .expect(200);
      expect(coms.body.items[0]).toMatchObject({
        order: { id: o.id, orderNo: o.orderNo },
        amountP: 10_000,
      });
    });

    it('changes the rate for new orders only, and needs a reason to suspend', async () => {
      const a = await newAffiliate(app, 'Max');
      const old = await attributedOrder(a.code);
      const url = `/v1/admin/affiliates/${a.res.body.id}`;
      const need = await owner.agent.patch(url).send({ status: 'suspended' }).expect(422);
      expect(need.body.code).toBe('AFFILIATE_SUSPEND_REASON');
      await owner.agent.patch(url).send({ commissionBp: 1000 }).expect(200);
      const fresh = await attributedOrder(a.code);
      expect((await commission(old.id)).commissionBp).toBe(500);
      expect((await commission(fresh.id)).commissionBp).toBe(1000);
      const sus = await owner.agent
        .patch(url)
        .send({ status: 'suspended', suspendedReason: 'fraud' })
        .expect(200);
      expect(sus.body).toMatchObject({
        status: 'suspended',
        suspendedReason: 'fraud',
        commissionBp: 1000,
      });
      const back = await owner.agent
        .patch(url)
        .send({ status: 'active', commissionBp: null })
        .expect(200);
      expect(back.body).toMatchObject({
        status: 'active',
        suspendedReason: null,
        commissionBp: 500,
        rateOverridden: false,
      });
      await owner.agent
        .get('/v1/admin/affiliates/00000000-0000-4000-8000-000000000000')
        .expect(404);
    });

    it('masks payout details unless the staff member can manage payouts; enforces permissions', async () => {
      const a = await newAffiliate(app, 'Ned');
      await a.agent
        .put('/v1/customer/affiliate/payout-details')
        .send({
          method: 'bank',
          bankName: 'DBBL',
          branch: 'Gulshan',
          accountNo: '1234567891234',
          accountName: 'Ned',
        })
        .expect(200);
      const id = a.res.body.id;
      const viewer = (await createStaffWith(app, ['affiliates.view'])).agent;
      const manager = (await createStaffWith(app, ['affiliates.view', 'affiliates.manage'])).agent;
      const payer = (await createStaffWith(app, ['affiliates.view', 'affiliate_payouts.manage']))
        .agent;

      expect((await viewer.get(`/v1/admin/affiliates/${id}`).expect(200)).body.payoutDetails).toBe(
        '…1234',
      );
      const full = await payer.get(`/v1/admin/affiliates/${id}`).expect(200);
      expect(full.body.payoutDetails).toMatchObject({ method: 'bank', accountNo: '1234567891234' });

      await viewer.get('/v1/admin/affiliates').expect(200);
      await viewer.patch(`/v1/admin/affiliates/${id}`).send({ commissionBp: 100 }).expect(403);
      await manager.patch(`/v1/admin/affiliates/${id}`).send({ commissionBp: 100 }).expect(200);
      for (const agent of [viewer, manager]) {
        await agent.get('/v1/admin/affiliate-payouts/due').expect(403);
        await agent.get('/v1/admin/affiliate-payouts').expect(403);
        await agent
          .post(`/v1/admin/affiliates/${id}/payouts`)
          .send({ method: 'cash', reference: 'x1', expectedAmountP: 1 })
          .expect(403);
      }
      await request(app.getHttpServer()).get('/v1/admin/affiliates').expect(401);
    });
  });
});

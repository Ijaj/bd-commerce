import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { OrderNotifyService } from '../src/orders/order-notify.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { addToCart, makeProduct, places } from './cart-fixtures';
import { createApp, createOwner, createStaffWith } from './helpers';
import { makeCoupon, makeFlash, placeAs, resetPromos } from './promotions-engine-fixtures';

type Made = Awaited<ReturnType<typeof makeProduct>>;

describe('admin order edit (A1)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let owner: Awaited<ReturnType<typeof createOwner>>;
  let notify: ReturnType<typeof vi.spyOn>;

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
  });
  beforeEach(async () => {
    await resetPromos(app);
    await prisma.$executeRawUnsafe('TRUNCATE order_edits, couriers CASCADE');
    owner = await createOwner(app);
    notify = vi.spyOn(app.get(OrderNotifyService), 'event');
  });
  afterAll(() => app.close());

  const anon = () => request.agent(app.getHttpServer());

  /** A guest order for the given lines (variant, qty), optionally with typed coupon codes. */
  async function place(lines: { made: Made; qty: number }[], codes: string[] = []) {
    const a = anon();
    for (const l of lines) await addToCart(a, l.made.variant.id, l.qty);
    for (const code of codes) await a.post('/v1/cart/coupon').send({ code }).expect(200);
    const res = await placeAs(app, a);
    expect(res.status).toBe(200);
    return prisma.order.findUniqueOrThrow({
      where: { orderNo: res.body.orderNo },
      include: { items: { orderBy: { id: 'asc' } } },
    });
  }

  const inv = (variantId: string) => prisma.inventory.findUniqueOrThrow({ where: { variantId } });
  const sold = async (made: Made) =>
    (await prisma.product.findUniqueOrThrow({ where: { id: made.product.id } })).soldCount;
  const edit = (id: string, body: unknown) =>
    owner.agent.post(`/v1/admin/orders/${id}/edit`).send(body as object);
  const preview = (id: string, body: unknown) =>
    owner.agent.post(`/v1/admin/orders/${id}/edit/preview`).send(body as object);

  it('qty down keeps the ordered price, releases stock and sold count; preview equals saved', async () => {
    const m = await makeProduct(app, { priceP: 100_000, stock: 10 });
    const order = await place([{ made: m, qty: 3 }]);
    const line = order.items[0];
    expect(await inv(m.variant.id)).toMatchObject({ reserved: 3 });
    // Today's price is higher, but the unchanged unit keeps the ordered price.
    await prisma.variant.update({ where: { id: m.variant.id }, data: { priceP: 150_000 } });

    const body = { lines: [{ orderItemId: line?.id, qty: 1 }], note: 'Customer asked for one' };
    const pv = (await preview(order.id, body).expect(200)).body;
    expect(pv.lines).toHaveLength(1);
    expect(pv.lines[0]).toMatchObject({ qty: 1, unitPriceP: 100_000, change: 'qty' });
    expect(pv.before.grandTotalP).toBe(order.grandTotalP);
    // The preview wrote nothing.
    expect(await inv(m.variant.id)).toMatchObject({ reserved: 3 });
    expect(await prisma.orderEdit.count()).toBe(0);

    const saved = (await edit(order.id, body).expect(200)).body;
    expect(saved.order.money).toMatchObject(pv.money);
    expect(saved.order.items[0]).toMatchObject({
      qty: 1,
      unitPriceP: 100_000,
      lineTotalP: 100_000,
    });
    expect(saved.order.money.codDueP).toBe(pv.money.grandTotalP);
    expect(await inv(m.variant.id)).toMatchObject({ reserved: 1 });
    expect(await sold(m)).toBe(1);
    const mv = await prisma.stockMovement.findMany({
      where: { variantId: m.variant.id, reason: 'order_release' },
    });
    expect(mv).toHaveLength(1);
    expect(mv[0]).toMatchObject({ reservedDelta: -2, refType: 'order', refId: order.id });
    const pay = await prisma.payment.findFirstOrThrow({ where: { orderId: order.id } });
    expect(pay.amountP).toBe(pv.money.grandTotalP);

    const row = await prisma.orderEdit.findFirstOrThrow();
    expect(row).toMatchObject({ orderId: order.id, note: 'Customer asked for one' });
    expect((row.before as { lines: { qty: number }[] }).lines[0]?.qty).toBe(3);
    expect((row.after as { lines: { qty: number }[] }).lines[0]?.qty).toBe(1);
    expect(notify).toHaveBeenCalledWith(order.id, 'edited', { editId: row.id });

    const hist = (await owner.agent.get(`/v1/admin/orders/${order.id}/edits`).expect(200)).body;
    expect(hist.items).toHaveLength(1);
    expect(hist.items[0]).toMatchObject({ staff: { name: 'Owner One' }, note: row.note });
  });

  it('qty up: added units use today price on a second line; same price merges', async () => {
    const m = await makeProduct(app, { priceP: 100_000, stock: 10 });
    const order = await place([{ made: m, qty: 1 }]);
    const id = order.items[0]?.id;

    // Same price: one line, qty 3.
    const same = (await edit(order.id, { lines: [{ orderItemId: id, qty: 3 }] }).expect(200)).body;
    expect(same.order.items).toHaveLength(1);
    expect(same.order.items[0]).toMatchObject({ qty: 3, unitPriceP: 100_000 });
    expect(await inv(m.variant.id)).toMatchObject({ reserved: 3 });
    expect(await sold(m)).toBe(3);

    // Price went up: the 3 old units stay, 2 added units at the new price on their own line.
    await prisma.variant.update({ where: { id: m.variant.id }, data: { priceP: 120_000 } });
    const res = (await edit(order.id, { lines: [{ orderItemId: id, qty: 5 }] }).expect(200)).body;
    expect(res.order.items).toHaveLength(2);
    const [old, extra] = res.order.items;
    expect(old).toMatchObject({ id, qty: 3, unitPriceP: 100_000, lineTotalP: 300_000 });
    expect(extra).toMatchObject({ qty: 2, unitPriceP: 120_000, lineTotalP: 240_000 });
    expect(res.order.money.subtotalP).toBe(540_000);
    expect(await inv(m.variant.id)).toMatchObject({ reserved: 5 });
    expect(await sold(m)).toBe(5);

    // A later decrease keeps the old price of the units that stay.
    const down = (
      await edit(order.id, {
        lines: [
          { orderItemId: id, qty: 2 },
          { orderItemId: extra.id, qty: 0 },
        ],
      })
    ).body;
    expect(down.order.items).toHaveLength(1);
    expect(down.order.items[0]).toMatchObject({ qty: 2, unitPriceP: 100_000 });
    expect(await inv(m.variant.id)).toMatchObject({ reserved: 2 });
    expect(await sold(m)).toBe(2);
  });

  it('adds and removes lines', async () => {
    const a = await makeProduct(app, { priceP: 100_000, stock: 10 });
    const b = await makeProduct(app, { priceP: 50_000, stock: 10 });
    const order = await place([{ made: a, qty: 2 }]);
    const lineA = order.items[0];

    const added = (
      await edit(order.id, {
        lines: [
          { orderItemId: lineA?.id, qty: 2 },
          { variantId: b.variant.id, qty: 2 },
        ],
      }).expect(200)
    ).body;
    expect(added.order.items).toHaveLength(2);
    expect(added.order.money.subtotalP).toBe(300_000);
    expect(await inv(b.variant.id)).toMatchObject({ reserved: 2 });
    expect(await sold(b)).toBe(2);
    const lineB = added.order.items.find(
      (i: { variantId: string }) => i.variantId === b.variant.id,
    );
    expect(lineB).toMatchObject({ qty: 2, unitPriceP: 50_000, titleSnapshot: b.product.titleEn });

    const removed = (
      await edit(order.id, {
        lines: [
          { orderItemId: lineA?.id, qty: 0 },
          { orderItemId: lineB.id, qty: 2 },
        ],
      })
    ).body;
    expect(removed.order.items).toHaveLength(1);
    expect(removed.order.items[0].id).toBe(lineB.id);
    expect(await inv(a.variant.id)).toMatchObject({ reserved: 0 });
    expect(await sold(a)).toBe(0);
    expect(await prisma.orderItem.count({ where: { id: lineA?.id } })).toBe(0);

    // Emptying the order is a cancel, not an edit.
    const empty = await edit(order.id, { lines: [{ orderItemId: lineB.id, qty: 0 }] }).expect(422);
    expect(empty.body.code).toBe('EMPTY_ORDER');
    const bad = await edit(order.id, { lines: [{ orderItemId: lineA?.id, qty: 1 }] }).expect(422);
    expect(bad.body.code).toBe('EDIT_INVALID');
    await prisma.product.update({ where: { id: a.product.id }, data: { status: 'draft' } });
    const gone = await edit(order.id, {
      lines: [
        { orderItemId: lineB.id, qty: 2 },
        { variantId: a.variant.id, qty: 1 },
      ],
    }).expect(422);
    expect(gone.body.code).toBe('VARIANT_UNAVAILABLE');
  });

  it('refuses when stock is short and rolls everything back', async () => {
    const m = await makeProduct(app, { priceP: 100_000, stock: 4 });
    const order = await place([{ made: m, qty: 3 }]);
    const r = await edit(order.id, { lines: [{ orderItemId: order.items[0]?.id, qty: 6 }] }).expect(
      409,
    );
    expect(r.body).toMatchObject({ code: 'STOCK_SHORT', variantId: m.variant.id });
    expect(await inv(m.variant.id)).toMatchObject({ reserved: 3 });
    expect(await sold(m)).toBe(3);
    expect(await prisma.orderEdit.count()).toBe(0);
  });

  it('re-evaluates coupons: kept ones are re-booked once, failing ones drop with a warning', async () => {
    const m = await makeProduct(app, { priceP: 100_000, stock: 20 });
    const keep = await makeCoupon(app, {
      code: 'KEEP10',
      value: 1000,
      stacksWithOtherCoupons: true,
    });
    const big = await makeCoupon(app, {
      code: 'BIG20',
      value: 2000,
      minOrderP: 250_000,
      stacksWithOtherCoupons: true,
    });
    const order = await place([{ made: m, qty: 3 }], ['KEEP10', 'BIG20']);
    expect(order.couponDiscountP).toBeGreaterThan(0);
    const usesOf = async (id: string) =>
      (await prisma.coupon.findUniqueOrThrow({ where: { id } })).usesCount;
    expect(await usesOf(keep.id)).toBe(1);
    expect(await usesOf(big.id)).toBe(1);

    const body = { lines: [{ orderItemId: order.items[0]?.id, qty: 2 }] };
    const pv = (await preview(order.id, body).expect(200)).body;
    expect(pv.warnings.join(' ')).toContain('BIG20');
    const res = (await edit(order.id, body).expect(200)).body;
    expect(res.order.money).toMatchObject(pv.money);
    expect(res.order.discounts.map((d: { code: string }) => d.code)).toEqual(['KEEP10']);
    expect(res.order.money.couponDiscountP).toBe(20_000);
    expect(await usesOf(keep.id)).toBe(1);
    expect(await usesOf(big.id)).toBe(0);
    const reds = await prisma.couponRedemption.findMany({ where: { orderId: order.id } });
    expect(reds.map((r) => [r.couponId === keep.id, r.status]).sort()).toEqual([
      [false, 'reversed'],
      [true, 'applied'],
    ]);
    expect((await prisma.coupon.findUniqueOrThrow({ where: { id: keep.id } })).discountGivenP).toBe(
      20_000,
    );
  });

  it('flash: kept units keep the flash price, added units are limited by what is left', async () => {
    const m = await makeProduct(app, { priceP: 100_000, stock: 20 });
    const { item } = await makeFlash(app, m.variant.id, { flashPriceP: 60_000, qtyLimit: 4 });
    const order = await place([{ made: m, qty: 1 }]);
    expect(order.items[0]).toMatchObject({ priceSource: 'flash', unitPriceP: 60_000 });
    const qtySold = async () =>
      (await prisma.flashSaleItem.findUniqueOrThrow({ where: { id: item.id } })).qtySold;
    expect(await qtySold()).toBe(1);

    const id = order.items[0]?.id;
    const over = await edit(order.id, { lines: [{ orderItemId: id, qty: 6 }] }).expect(409);
    expect(over.body).toMatchObject({ code: 'FLASH_LIMIT', variantId: m.variant.id, remaining: 3 });
    expect(await qtySold()).toBe(1);

    const ok = (await edit(order.id, { lines: [{ orderItemId: id, qty: 4 }] }).expect(200)).body;
    expect(ok.order.items).toHaveLength(1);
    expect(ok.order.items[0]).toMatchObject({ qty: 4, unitPriceP: 60_000, priceSource: 'flash' });
    expect(await qtySold()).toBe(4);
    expect((await prisma.orderItem.findUniqueOrThrow({ where: { id } })).flashSaleItemId).toBe(
      item.id,
    );

    const down = (await edit(order.id, { lines: [{ orderItemId: id, qty: 2 }] }).expect(200)).body;
    expect(down.order.items[0]).toMatchObject({ qty: 2, unitPriceP: 60_000 });
    expect(await qtySold()).toBe(2);
  });

  it('address-only edit changes zone and delivery charge, not stock or sold count', async () => {
    const p = await places(app);
    const m = await makeProduct(app, { priceP: 100_000, stock: 10 });
    const order = await place([{ made: m, qty: 1 }]);
    const inside = order.deliveryChargeP;
    const far = await prisma.upazila.findUniqueOrThrow({ where: { id: p.far.upazilaId } });

    const pv = (
      await preview(order.id, {
        ship: { upazilaId: far.id, line: 'New road 9', name: 'Rina' },
      }).expect(200)
    ).body;
    expect(pv.zone.id).not.toBe(order.zoneId);
    expect(pv.money.deliveryChargeP).not.toBe(inside);
    const res = (
      await edit(order.id, {
        ship: { upazilaId: far.id, line: 'New road 9', name: 'Rina' },
      }).expect(200)
    ).body;
    expect(res.order.money).toMatchObject(pv.money);
    expect(res.order.zone.id).toBe(pv.zone.id);
    expect(res.order.shipTo).toMatchObject({
      name: 'Rina',
      line: 'New road 9',
      upazilaId: far.id,
      districtId: far.districtId,
      areaId: null,
    });
    expect(res.order.shipTo.placeText).toContain(far.nameEn);
    expect(await inv(m.variant.id)).toMatchObject({ reserved: 1 });
    expect(await sold(m)).toBe(1);

    const bad = await edit(order.id, { ship: { upazilaId: 999_999 } }).expect(422);
    expect(bad.body.code).toBe('ADDRESS_UNSERVICEABLE');
    const phone = await edit(order.id, { ship: { phone: '12345' } }).expect(422);
    expect(phone.body.code).toBe('EDIT_INVALID');
  });

  describe('when an order cannot be edited', () => {
    it('refuses booked or sent shipments and finished orders; cancels local shipments on save', async () => {
      const m = await makeProduct(app, { priceP: 100_000, stock: 10 });
      const order = await place([{ made: m, qty: 2 }]);
      const item = order.items[0];
      const seller = await prisma.seller.findFirstOrThrow();
      const ship = await prisma.shipment.create({
        data: {
          orderId: order.id,
          shipmentNo: 'SHP-E-1',
          sellerId: seller.id,
          status: 'ready',
          items: { create: { orderItemId: item?.id as string, qty: 2 } },
        },
      });
      const body = { lines: [{ orderItemId: item?.id, qty: 1 }] };
      const pv = (await preview(order.id, body).expect(200)).body;
      expect(pv.warnings.join(' ')).toContain('shipment');
      await edit(order.id, body).expect(200);
      expect((await prisma.shipment.findUniqueOrThrow({ where: { id: ship.id } })).status).toBe(
        'cancelled',
      );

      await prisma.shipment.update({ where: { id: ship.id }, data: { status: 'booked' } });
      const r = await edit(order.id, { lines: [{ orderItemId: item?.id, qty: 2 }] }).expect(409);
      expect(r.body.code).toBe('SHIPMENT_BOOKED');
      await preview(order.id, body).expect(409);
      expect(await inv(m.variant.id)).toMatchObject({ reserved: 1 });

      await prisma.shipment.update({ where: { id: ship.id }, data: { status: 'cancelled' } });
      for (const status of ['delivered', 'cancelled', 'shipped'] as const) {
        await prisma.order.update({ where: { id: order.id }, data: { status } });
        const x = await edit(order.id, body).expect(409);
        expect(x.body.code).toBe('ORDER_NOT_EDITABLE');
      }
      await prisma.order.update({ where: { id: order.id }, data: { status: 'on_hold' } });
      await edit(order.id, { lines: [{ orderItemId: item?.id, qty: 2 }] }).expect(200);
    });

    it('needs orders.edit; reading history needs orders.view', async () => {
      const m = await makeProduct(app, { priceP: 100_000, stock: 10 });
      const order = await place([{ made: m, qty: 2 }]);
      const body = { lines: [{ orderItemId: order.items[0]?.id, qty: 1 }] };
      const viewer = await createStaffWith(app, ['orders.view', 'orders.manage']);
      await viewer.agent.post(`/v1/admin/orders/${order.id}/edit`).send(body).expect(403);
      await viewer.agent.post(`/v1/admin/orders/${order.id}/edit/preview`).send(body).expect(403);
      await viewer.agent.get(`/v1/admin/orders/${order.id}/edits`).expect(200);
      const editor = await createStaffWith(app, ['orders.edit']);
      await editor.agent.get(`/v1/admin/orders/${order.id}/edits`).expect(403);
      await editor.agent.post(`/v1/admin/orders/${order.id}/edit`).send(body).expect(200);
      await request(app.getHttpServer())
        .post(`/v1/admin/orders/${order.id}/edit`)
        .send(body)
        .expect(401);
    });
  });

  describe('list filters + couriers', () => {
    it('filters by courier, zone, payment method and source; lists couriers', async () => {
      const m = await makeProduct(app, { priceP: 50_000, stock: 20 });
      const a = await place([{ made: m, qty: 1 }]);
      const b = await place([{ made: m, qty: 1 }]);
      const cust = await prisma.customer.create({
        data: { name: 'Rahim', phone: '01712345678', passwordHash: 'x' } as never,
      });
      await prisma.order.update({ where: { id: b.id }, data: { customerId: cust.id } });
      const zones = await prisma.deliveryZone.findMany({ orderBy: { sort: 'asc' } });
      await prisma.order.update({
        where: { id: b.id },
        data: { zoneId: zones[1]?.id as string, paymentMethodChosen: 'bkash' },
      });
      const courier = await prisma.courier.create({
        data: { code: 'steadfast', name: 'Steadfast' },
      });
      const seller = await prisma.seller.findFirstOrThrow();
      await prisma.shipment.create({
        data: { orderId: a.id, shipmentNo: 'SHP-E-9', sellerId: seller.id, courierId: courier.id },
      });

      const list = async (qs: string) =>
        (await owner.agent.get(`/v1/admin/orders${qs}`).expect(200)).body.items.map(
          (i: { id: string }) => i.id,
        );
      expect(await list(`?courierId=${courier.id}`)).toEqual([a.id]);
      expect(await list(`?zoneId=${zones[1]?.id}`)).toEqual([b.id]);
      expect(await list('?paymentMethod=bkash')).toEqual([b.id]);
      expect(await list('?paymentMethod=cod')).toEqual([a.id]);
      expect(await list('?source=guest')).toEqual([a.id]);
      expect(await list('?source=customer')).toEqual([b.id]);
      expect(await list(`?source=guest&paymentMethod=bkash`)).toEqual([]);
      await owner.agent.get('/v1/admin/orders?source=robot').expect(400);

      const couriers = (await owner.agent.get('/v1/admin/couriers').expect(200)).body;
      expect(couriers).toEqual([
        { id: courier.id, code: 'steadfast', name: 'Steadfast', isActive: true },
      ]);
      const noPerm = await createStaffWith(app, ['settings.view']);
      await noPerm.agent.get('/v1/admin/couriers').expect(403);
    });
  });
});

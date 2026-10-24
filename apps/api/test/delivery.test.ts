import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DeliveryService } from '../src/delivery/delivery.service';
import type { DeliveryZone } from '../src/generated/prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { addToCart, makeProduct, places, resetCommerce } from './cart-fixtures';
import { createApp, createOwner, createStaffWith } from './helpers';

const zone = (o: Partial<DeliveryZone> = {}): DeliveryZone => ({
  id: 'z',
  nameEn: 'Z',
  nameBn: null,
  baseChargeP: 6000,
  baseWeightG: 1000,
  extraPerKgP: 1500,
  etaMinDays: 1,
  etaMaxDays: 2,
  freeAboveP: null,
  isDefault: false,
  sort: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...o,
});

describe('delivery charge rules', () => {
  const svc = new DeliveryService(null as never);

  it('charges the base up to the base weight, then per started kg', () => {
    const base = { subtotalP: 100_000, overridesP: [] };
    expect(svc.charge(zone(), { ...base, weightG: 1000 }).deliveryChargeP).toBe(6000);
    expect(svc.charge(zone(), { ...base, weightG: 1001 }).deliveryChargeP).toBe(7500);
    expect(svc.charge(zone(), { ...base, weightG: 3500 }).deliveryChargeP).toBe(6000 + 3 * 1500);
  });

  it('takes the dearest of the zone charge and product overrides, once per order (Q85)', () => {
    const input = { subtotalP: 1000, weightG: 500 };
    expect(svc.charge(zone(), { ...input, overridesP: [3000, 9000] }).deliveryChargeP).toBe(9000);
    expect(svc.charge(zone(), { ...input, overridesP: [3000] }).deliveryChargeP).toBe(6000);
  });

  it('free delivery: null never, 0 always, threshold inclusive', () => {
    const input = { weightG: 500, overridesP: [] };
    expect(
      svc.charge(zone({ freeAboveP: null }), { ...input, subtotalP: 9e9 }).deliveryDiscountP,
    ).toBe(0);
    const always = svc.charge(zone({ freeAboveP: 0 }), { ...input, subtotalP: 1 });
    expect(always).toMatchObject({
      deliveryChargeP: 6000,
      deliveryDiscountP: 6000,
      freeDeliveryRemainingP: null,
    });
    const z = zone({ freeAboveP: 300_000 });
    expect(svc.charge(z, { ...input, subtotalP: 299_999 })).toMatchObject({
      deliveryDiscountP: 0,
      freeDeliveryRemainingP: 1,
    });
    expect(svc.charge(z, { ...input, subtotalP: 300_000 }).deliveryDiscountP).toBe(6000);
  });
});

describe('delivery zones', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
  });
  beforeEach(() => resetCommerce(app));
  afterAll(() => app.close());

  const quote = async (loc: object) => {
    const { variant } = await makeProduct(app, { priceP: 50_000 });
    const agent = request.agent(app.getHttpServer());
    await addToCart(agent, variant.id);
    return (await agent.post('/v1/checkout/quote').send(loc).expect(200)).body;
  };

  it('picks the most specific zone: upazila beats district, default is the fallback', async () => {
    const p = await places(app);
    expect((await quote(p.dhaka)).zone.nameEn).toBe('Inside Dhaka');
    // Savar is a Dhaka district upazila without its own row: district row -> suburbs.
    expect((await quote(p.savar)).zone.nameEn).toBe('Dhaka suburbs');
    expect((await quote(p.suburb)).zone.nameEn).toBe('Dhaka suburbs');
    expect((await quote(p.far)).zone.nameEn).toBe('Outside Dhaka');
  });

  it('requires delivery.manage', async () => {
    await request(app.getHttpServer()).get('/v1/admin/delivery-zones').expect(401);
    const { agent } = await createStaffWith(app, ['orders.view']);
    await agent.get('/v1/admin/delivery-zones').expect(403);
    const ok = await createStaffWith(app, ['delivery.manage']);
    const res = await ok.agent.get('/v1/admin/delivery-zones').expect(200);
    expect(res.body.map((z: { nameEn: string }) => z.nameEn)).toEqual([
      'Inside Dhaka',
      'Dhaka suburbs',
      'Outside Dhaka',
    ]);
    expect(res.body[0].locations[0]).toMatchObject({ level: 'upazila' });
  });

  it('creates, edits and deletes zones; the default moves and cannot be deleted', async () => {
    const { agent } = await createOwner(app);
    const p = await places(app);
    const created = await agent
      .post('/v1/admin/delivery-zones')
      .send({
        nameEn: 'Sylhet',
        baseChargeP: 15_000,
        etaMinDays: 3,
        etaMaxDays: 6,
        freeAboveP: 0,
        locations: [{ districtId: p.far.districtId }],
      })
      .expect(201);
    expect(created.body.locations).toHaveLength(1);
    expect(created.body.baseWeightG).toBe(1000);
    expect((await quote(p.far)).zone.nameEn).toBe('Sylhet');

    await agent
      .patch(`/v1/admin/delivery-zones/${created.body.id}`)
      .send({ etaMinDays: 5, etaMaxDays: 2 })
      .expect(400);
    const edited = await agent
      .patch(`/v1/admin/delivery-zones/${created.body.id}`)
      .send({ baseChargeP: 20_000, isDefault: true })
      .expect(200);
    expect(edited.body).toMatchObject({ baseChargeP: 20_000, isDefault: true });
    expect(await prisma.deliveryZone.count({ where: { isDefault: true } })).toBe(1);

    await agent.delete(`/v1/admin/delivery-zones/${created.body.id}`).expect(409);
    await agent
      .patch(`/v1/admin/delivery-zones/${created.body.id}`)
      .send({ isDefault: false })
      .expect(409);
    const outside = await prisma.deliveryZone.findFirstOrThrow({
      where: { nameEn: 'Outside Dhaka' },
    });
    await agent.delete(`/v1/admin/delivery-zones/${outside.id}`).expect(204);
    await agent.delete(`/v1/admin/delivery-zones/${outside.id}`).expect(404);
  });

  it('rejects a location already used by another zone, and malformed locations', async () => {
    const { agent } = await createOwner(app);
    const p = await places(app);
    const suburbs = await prisma.deliveryZone.findFirstOrThrow({
      where: { nameEn: 'Dhaka suburbs' },
    });
    const inside = await prisma.deliveryZone.findFirstOrThrow({
      where: { nameEn: 'Inside Dhaka' },
    });
    const taken = await agent
      .post(`/v1/admin/delivery-zones/${inside.id}/locations`)
      .send({ locations: [{ districtId: 41 }] })
      .expect(409);
    expect(taken.body.code).toBe('LOCATION_TAKEN');
    await agent
      .post(`/v1/admin/delivery-zones/${inside.id}/locations`)
      .send({ locations: [{ districtId: 1, upazilaId: 2 }] })
      .expect(400);
    await agent
      .post(`/v1/admin/delivery-zones/${inside.id}/locations`)
      .send({ locations: [{ districtId: 99999 }] })
      .expect(400);

    // Moving Savar to its own upazila row inside Dhaka overrides the district row of the suburbs.
    const moved = await agent
      .post(`/v1/admin/delivery-zones/${inside.id}/locations`)
      .send({ locations: [{ upazilaId: p.savar.upazilaId }] })
      .expect(200);
    const loc = moved.body.locations.find(
      (l: { upazilaId: number | null }) => l.upazilaId === p.savar.upazilaId,
    );
    expect((await quote(p.savar)).zone.nameEn).toBe('Inside Dhaka');
    await agent.delete(`/v1/admin/delivery-zones/${inside.id}/locations/${loc.id}`).expect(200);
    expect((await quote(p.savar)).zone.nameEn).toBe('Dhaka suburbs');
    expect(suburbs.id).toBeTruthy();
  });
});

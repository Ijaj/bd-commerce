import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createApp, createOwner, resetDb, signInFresh } from './helpers';

const maintenanceOn = {
  enabled: true,
  message: { en: 'Back at 6pm', bn: 'সন্ধ্যা ৬টায় ফিরছি' },
};

describe('settings, flags and maintenance', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createApp();
  });
  beforeEach(() => resetDb(app));
  afterAll(() => app.close());

  it('lists every setting with defaults and a JSON schema', async () => {
    const { agent } = await createOwner(app);
    const res = await agent.get('/v1/admin/settings').expect(200);
    const flag = res.body.find((s: { key: string }) => s.key === 'preorders_enabled');
    expect(flag).toMatchObject({ value: false, isDefault: true, schema: { type: 'boolean' } });
  });

  it('validates, stores, and resets values', async () => {
    const { agent } = await createOwner(app);
    await agent.put('/v1/admin/settings/preorders_enabled').send({ value: 'yes' }).expect(400);
    await agent.put('/v1/admin/settings/no_such_key').send({ value: true }).expect(404);
    await agent.put('/v1/admin/settings/preorders_enabled').send({ value: true }).expect(204);

    const site = await request(app.getHttpServer()).get('/v1/public/site').expect(200);
    expect(site.body.flags.preorders_enabled).toBe(true);

    await agent.delete('/v1/admin/settings/preorders_enabled').expect(204);
    const after = await request(app.getHttpServer()).get('/v1/public/site').expect(200);
    expect(after.body.flags.preorders_enabled).toBe(false);
  });

  it('maintenance mode blocks customer routes but not admin, site status or health', async () => {
    const { agent } = await createOwner(app);
    const server = app.getHttpServer();
    await agent
      .put('/v1/admin/settings/maintenance_mode')
      .send({ value: maintenanceOn })
      .expect(204);

    const blocked = await request(server).get('/v1/catalog/products').expect(503);
    expect(blocked.body.message).toEqual(maintenanceOn.message);
    expect(blocked.headers['retry-after']).toBe('300');

    const site = await request(server).get('/v1/public/site').expect(200);
    expect(site.body.maintenance).toEqual(maintenanceOn);
    await request(server).get('/health').expect(200);
    await agent.get('/v1/admin/auth/me').expect(200);
  });

  it('shows the announcement bar only inside its time window', async () => {
    const { agent } = await createOwner(app);
    const server = app.getHttpServer();
    const bar = { enabled: true, text: { en: 'Eid sale', bn: 'ঈদ সেল' }, link: '/sale' };
    const hour = 3_600_000;

    await agent
      .put('/v1/admin/settings/announcement_bar')
      .send({
        value: { ...bar, startsAt: null, endsAt: new Date(Date.now() - hour).toISOString() },
      })
      .expect(204);
    expect((await request(server).get('/v1/public/site')).body.announcement).toBeNull();

    await agent
      .put('/v1/admin/settings/announcement_bar')
      .send({
        value: { ...bar, startsAt: null, endsAt: new Date(Date.now() + hour).toISOString() },
      })
      .expect(204);
    expect((await request(server).get('/v1/public/site')).body.announcement).toEqual({
      text: bar.text,
      link: '/sale',
    });
  });

  it('uses the staff_session_timeout_min setting when staff has no override', async () => {
    const { agent } = await createOwner(app);
    await agent.put('/v1/admin/settings/staff_session_timeout_min').send({ value: 10 }).expect(204);
    await app.get(PrismaService).staffSession.updateMany({
      data: { lastSeenAt: new Date(Date.now() - 11 * 60_000) },
    });
    await agent.get('/v1/admin/auth/me').expect(401);
  });

  it('needs settings.manage to change settings', async () => {
    const owner = await createOwner(app);
    const role = await owner.agent
      .post('/v1/admin/roles')
      .send({ name: 'Settings viewer', permissions: ['settings.view'] })
      .expect(201);
    const created = await owner.agent
      .post('/v1/admin/staff')
      .send({ name: 'v', email: 'v@example.com', roleIds: [role.body.id] })
      .expect(201);
    const { agent } = await signInFresh(app, 'v@example.com', created.body.tempPassword);
    await agent.get('/v1/admin/settings').expect(200);
    await agent.put('/v1/admin/settings/preorders_enabled').send({ value: true }).expect(403);
  });
});

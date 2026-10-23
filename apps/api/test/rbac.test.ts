import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { type Agent, createApp, createOwner, resetDb, signInFresh } from './helpers';

describe('staff management and RBAC', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createApp();
  });
  beforeEach(() => resetDb(app));
  afterAll(() => app.close());

  async function makeRole(agent: Agent, name: string, permissions: string[]) {
    const res = await agent.post('/v1/admin/roles').send({ name, permissions }).expect(201);
    return res.body.id as string;
  }

  async function makeStaff(agent: Agent, email: string, roleIds: string[]) {
    const res = await agent
      .post('/v1/admin/staff')
      .send({ name: email.split('@')[0], email, roleIds })
      .expect(201);
    const signedIn = await signInFresh(app, email, res.body.tempPassword);
    return { id: res.body.staff.id as string, ...signedIn };
  }

  it('enforces route permissions', async () => {
    const owner = await createOwner(app);
    const viewer = await makeStaff(owner.agent, 'viewer@example.com', [
      await makeRole(owner.agent, 'Viewer', ['staff.view']),
    ]);
    const list = await viewer.agent.get('/v1/admin/staff').expect(200);
    expect(list.body.map((s: { email: string }) => s.email).sort()).toEqual([
      'owner@example.com',
      'viewer@example.com',
    ]);
    await viewer.agent
      .post('/v1/admin/staff')
      .send({ name: 'x', email: 'x@example.com', roleIds: [] })
      .expect(403);
    await viewer.agent.post('/v1/admin/roles').send({ name: 'R', permissions: [] }).expect(403);
  });

  it('only lets staff grant permissions they hold (Q65)', async () => {
    const owner = await createOwner(app);
    const roles = (await owner.agent.get('/v1/admin/roles').expect(200)).body as {
      id: string;
      name: string;
    }[];
    const ownerRoleId = roles.find((r) => r.name === 'Owner')?.id as string;
    const manager = await makeStaff(owner.agent, 'manager@example.com', [
      await makeRole(owner.agent, 'Manager', ['staff.view', 'staff.manage']),
    ]);

    // Can't hand out the Owner role or a role with roles.manage.
    await manager.agent
      .post('/v1/admin/staff')
      .send({ name: 'y', email: 'y@example.com', roleIds: [ownerRoleId] })
      .expect(403);
    const admin = await makeRole(owner.agent, 'Role admin', ['roles.manage']);
    await manager.agent
      .post('/v1/admin/staff')
      .send({ name: 'z', email: 'z@example.com', roleIds: [admin] })
      .expect(403);
    // Can't disable someone holding more than they do.
    await manager.agent
      .patch(`/v1/admin/staff/${await ownerId(owner.agent)}`)
      .send({ disabled: true })
      .expect(403);
  });

  it('keeps at least one active Owner and stops self-disable', async () => {
    const owner = await createOwner(app);
    const id = await ownerId(owner.agent);
    await owner.agent.patch(`/v1/admin/staff/${id}`).send({ disabled: true }).expect(400);
    await owner.agent.patch(`/v1/admin/staff/${id}`).send({ roleIds: [] }).expect(400);
  });

  it('disabling staff signs them out', async () => {
    const owner = await createOwner(app);
    const viewer = await makeStaff(owner.agent, 'viewer@example.com', [
      await makeRole(owner.agent, 'Viewer', ['staff.view']),
    ]);
    await owner.agent.patch(`/v1/admin/staff/${viewer.id}`).send({ disabled: true }).expect(200);
    await viewer.agent.get('/v1/admin/auth/me').expect(401);
  });

  it('resetting 2FA signs the person out and makes them set it up again (C14)', async () => {
    const owner = await createOwner(app);
    const viewer = await makeStaff(owner.agent, 'viewer@example.com', [
      await makeRole(owner.agent, 'Viewer', ['staff.view']),
    ]);
    const res = await owner.agent.post(`/v1/admin/staff/${viewer.id}/reset-2fa`).expect(200);
    expect(res.body.totpEnabled).toBe(false);
    await viewer.agent.get('/v1/admin/auth/me').expect(401);
  });

  it('rejects editing the Owner role and duplicate role names', async () => {
    const owner = await createOwner(app);
    const roles = (await owner.agent.get('/v1/admin/roles').expect(200)).body as {
      id: string;
      name: string;
    }[];
    const ownerRole = roles.find((r) => r.name === 'Owner')?.id as string;
    await owner.agent.patch(`/v1/admin/roles/${ownerRole}`).send({ name: 'Boss' }).expect(400);
    await makeRole(owner.agent, 'Packer', []);
    await owner.agent.post('/v1/admin/roles').send({ name: 'Packer', permissions: [] }).expect(409);
  });

  async function ownerId(agent: Agent) {
    return ((await agent.get('/v1/admin/auth/me').expect(200)).body as { id: string }).id;
  }
});

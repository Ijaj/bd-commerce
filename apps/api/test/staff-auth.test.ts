import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MailService } from '../src/mail/mail.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { createApp, createOwner, resetDb, totpCode } from './helpers';

describe('staff auth', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createApp();
  });
  beforeEach(() => resetDb(app));
  afterAll(() => app.close());

  it('requires 2FA setup on first login, then signs in with all Owner permissions', async () => {
    const { agent, backupCodes } = await createOwner(app);
    expect(backupCodes).toHaveLength(10);
    const me = await agent.get('/v1/admin/auth/me').expect(200);
    expect(me.body.roles).toEqual([expect.objectContaining({ name: 'Owner' })]);
    expect(me.body.permissions).toEqual(['roles.manage', 'staff.manage', 'staff.view']);
  });

  it('blocks everything but 2FA endpoints until the second factor passes', async () => {
    const owner = await createOwner(app);
    const agent = request.agent(app.getHttpServer());
    await agent.post('/v1/admin/auth/login').send({ email: owner.email, password: owner.password });
    await agent.get('/v1/admin/auth/me').expect(401);
    await agent.get('/v1/admin/staff').expect(401);
  });

  it('verifies TOTP, rejects a replayed code, and accepts each backup code once', async () => {
    const owner = await createOwner(app);
    const server = app.getHttpServer();

    const a = request.agent(server);
    const login = await a
      .post('/v1/admin/auth/login')
      .send({ email: owner.email, password: owner.password });
    expect(login.body).toEqual({ next: 'mfa_verify' });
    // Same time step as the code used at setup: replay.
    await a
      .post('/v1/admin/auth/2fa/verify')
      .send({ code: totpCode(owner.secret) })
      .expect(401);
    await a
      .post('/v1/admin/auth/2fa/verify')
      .send({ code: totpCode(owner.secret, 1) })
      .expect(204);
    await a.get('/v1/admin/auth/me').expect(200);

    const backup = owner.backupCodes[0] as string;
    const b = request.agent(server);
    await b.post('/v1/admin/auth/login').send({ email: owner.email, password: owner.password });
    await b
      .post('/v1/admin/auth/2fa/verify')
      .send({ backupCode: backup.toUpperCase() })
      .expect(204);

    const c = request.agent(server);
    await c.post('/v1/admin/auth/login').send({ email: owner.email, password: owner.password });
    await c.post('/v1/admin/auth/2fa/verify').send({ backupCode: backup }).expect(401);
  });

  it('emails an alert on sign-in from a new device, not the first one', async () => {
    const owner = await createOwner(app);
    const outbox = app.get(MailService).outbox;
    expect(outbox).toHaveLength(0);

    const other = request.agent(app.getHttpServer());
    await other.post('/v1/admin/auth/login').send({ email: owner.email, password: owner.password });
    await other
      .post('/v1/admin/auth/2fa/verify')
      .send({ code: totpCode(owner.secret, 1) })
      .expect(204);
    expect(outbox).toEqual([
      expect.objectContaining({ to: owner.email, subject: 'New sign-in to your staff account' }),
    ]);
  });

  it('locks login for an email after 5 failures', async () => {
    const owner = await createOwner(app);
    const server = app.getHttpServer();
    for (let i = 0; i < 5; i++) {
      await request(server)
        .post('/v1/admin/auth/login')
        .send({ email: owner.email, password: 'wrong-password' })
        .expect(401);
    }
    await request(server)
      .post('/v1/admin/auth/login')
      .send({ email: owner.email, password: owner.password })
      .expect(429);
  });

  it('gives the same answer for unknown email and wrong password', async () => {
    await createOwner(app);
    const res = await request(app.getHttpServer())
      .post('/v1/admin/auth/login')
      .send({ email: 'nobody@example.com', password: 'whatever' })
      .expect(401);
    expect(res.body.message).toBe('Invalid email or password');
  });

  it('signs out after the idle timeout', async () => {
    const { agent } = await createOwner(app);
    const prisma = app.get(PrismaService);
    await prisma.staff.updateMany({ data: { sessionTimeoutMin: 5 } });
    await prisma.staffSession.updateMany({
      data: { lastSeenAt: new Date(Date.now() - 6 * 60_000) },
    });
    await agent.get('/v1/admin/auth/me').expect(401);
  });

  it('changing the password signs out other sessions but keeps this one', async () => {
    const owner = await createOwner(app);
    const second = request.agent(app.getHttpServer());
    await second
      .post('/v1/admin/auth/login')
      .send({ email: owner.email, password: owner.password });
    await second
      .post('/v1/admin/auth/2fa/verify')
      .send({ code: totpCode(owner.secret, 1) })
      .expect(204);

    await owner.agent
      .post('/v1/admin/auth/password')
      .send({ currentPassword: owner.password, newPassword: 'a-much-longer-password' })
      .expect(204);
    await owner.agent.get('/v1/admin/auth/me').expect(200);
    await second.get('/v1/admin/auth/me').expect(401);
  });

  it('logout revokes the session', async () => {
    const { agent } = await createOwner(app);
    await agent.post('/v1/admin/auth/logout').expect(204);
    await agent.get('/v1/admin/auth/me').expect(401);
  });
});

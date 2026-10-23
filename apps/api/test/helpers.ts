import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type Redis from 'ioredis';
import { Secret, TOTP } from 'otpauth';
import request from 'supertest';
import { expect } from 'vitest';
import { AppModule } from '../src/app.module';
import { MailService } from '../src/mail/mail.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { REDIS } from '../src/redis/redis.module';
import { configureApp } from '../src/setup';
import { StaffService } from '../src/staff/staff.service';

export async function createApp() {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  return app;
}

export async function resetDb(app: INestApplication) {
  const prisma = app.get(PrismaService);
  await prisma.$executeRawUnsafe(
    'TRUNCATE staff, staff_sessions, staff_known_devices, staff_backup_codes, staff_roles, role_permissions CASCADE',
  );
  await prisma.role.deleteMany({ where: { isSystem: false } });
  await app.get<Redis>(REDIS).flushdb();
  app.get(MailService).outbox.length = 0;
}

export function totpCode(secret: string, offsetSteps = 0) {
  return new TOTP({ secret: Secret.fromBase32(secret) }).generate({
    timestamp: Date.now() + offsetSteps * 30_000,
  });
}

export type Agent = ReturnType<typeof request.agent>;

/** Logs in and completes 2FA setup; returns the signed-in agent, TOTP secret and backup codes. */
export async function signInFresh(app: INestApplication, email: string, password: string) {
  const agent = request.agent(app.getHttpServer());
  const login = await agent.post('/v1/admin/auth/login').send({ email, password }).expect(200);
  expect(login.body).toEqual({ next: 'mfa_setup' });
  const setup = await agent.post('/v1/admin/auth/2fa/setup').expect(200);
  const secret: string = setup.body.secret;
  const enable = await agent
    .post('/v1/admin/auth/2fa/enable')
    .send({ code: totpCode(secret) })
    .expect(200);
  return { agent, secret, backupCodes: enable.body.backupCodes as string[] };
}

export async function createOwner(app: INestApplication, email = 'owner@example.com') {
  const { tempPassword } = await app.get(StaffService).createOwner(email, 'Owner One');
  return { email, password: tempPassword, ...(await signInFresh(app, email, tempPassword)) };
}

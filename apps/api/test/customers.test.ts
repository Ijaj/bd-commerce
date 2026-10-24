import type { INestApplication } from '@nestjs/common';
import type Redis from 'ioredis';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { normalizePhone } from '../src/customers/phone';
import { PrismaService } from '../src/prisma/prisma.service';
import { REDIS } from '../src/redis/redis.module';
import { SmsService } from '../src/sms/sms.service';
import { createApp, resetDb } from './helpers';

const PHONE = '01712345678';
const PASSWORD = 'correct horse';

describe('phone normalization', () => {
  it('accepts BD formats and Bangla digits, rejects the rest', () => {
    expect(normalizePhone('01712345678')).toBe(PHONE);
    expect(normalizePhone('+8801712345678')).toBe(PHONE);
    expect(normalizePhone('8801712345678')).toBe(PHONE);
    expect(normalizePhone('০১৭১২৩৪৫৬৭৮')).toBe(PHONE);
    expect(normalizePhone('017-1234 5678')).toBe(PHONE);
    expect(normalizePhone('01212345678')).toBeNull();
    expect(normalizePhone('0171234567')).toBeNull();
    expect(normalizePhone('12345')).toBeNull();
  });
});

describe('customer API', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let sms: SmsService;
  let redis: Redis;

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
    sms = app.get(SmsService);
    redis = app.get<Redis>(REDIS);
  });
  beforeEach(async () => {
    await resetDb(app);
    await prisma.customerSession.deleteMany();
    await prisma.otpCode.deleteMany();
    await prisma.customer.deleteMany();
    sms.outbox.length = 0;
  });
  afterAll(async () => {
    await prisma.customerSession.deleteMany();
    await prisma.otpCode.deleteMany();
    await prisma.customer.deleteMany();
    await app.close();
  });

  const server = () => app.getHttpServer();
  const lastCode = () => {
    const text = sms.outbox.at(-1)?.text ?? '';
    return /code: (\d{6})/.exec(text)?.[1] ?? '';
  };
  const skipCooldown = (phone = PHONE) => redis.del(`cust-otp:cooldown:${phone}`);

  async function signup(
    agent = request.agent(server()),
    over: Record<string, unknown> = {},
    phone = PHONE,
  ) {
    await agent.post('/v1/customer/auth/otp').send({ phone, purpose: 'signup' }).expect(200);
    const res = await agent
      .post('/v1/customer/auth/signup')
      .send({ name: 'Rahim', phone, password: PASSWORD, code: lastCode(), ...over });
    return { agent, res };
  }

  async function makeProduct(over: Record<string, unknown> = {}) {
    const seller =
      (await prisma.seller.findFirst()) ?? (await prisma.seller.create({ data: { name: 'Shop' } }));
    const cat =
      (await prisma.category.findUnique({ where: { slug: 'wl-cat' } })) ??
      (await prisma.category.create({
        data: { slug: 'wl-cat', nameEn: 'Cat', level: 1, path: '/wl-cat' },
      }));
    const slug = `p-${Math.random().toString(36).slice(2, 8)}`;
    return prisma.product.create({
      data: {
        sellerId: seller.id,
        primaryCategoryId: cat.id,
        titleEn: 'Phone',
        slug,
        status: 'active',
        publishedAt: new Date(Date.now() - 1000),
        variants: { create: { sku: `sku-${slug}`, priceP: 100000, compareAtP: 120000 } },
        ...over,
      },
    });
  }

  describe('OTP and signup', () => {
    it('sends a masked-response OTP by SMS and signs up with it', async () => {
      const agent = request.agent(server());
      const otp = await agent
        .post('/v1/customer/auth/otp')
        .send({ phone: '+8801712345678', purpose: 'signup' })
        .expect(200);
      expect(otp.body).toEqual({ sentTo: '017******78', expiresInSec: 300, resendInSec: 60 });
      expect(sms.outbox).toHaveLength(1);
      expect(sms.outbox[0]?.to).toBe(PHONE);
      expect(sms.outbox[0]?.text).toMatch(/code: \d{6}\. Valid 5 minutes\./);
      // Hash only in the DB.
      const row = await prisma.otpCode.findFirstOrThrow({ where: { phone: PHONE } });
      expect(row.codeHash).not.toContain(lastCode());

      const res = await agent
        .post('/v1/customer/auth/signup')
        .send({
          name: 'Rahim',
          phone: PHONE,
          email: 'Rahim@Example.com',
          password: PASSWORD,
          code: lastCode(),
        })
        .expect(200);
      expect(res.body.customer).toMatchObject({
        name: 'Rahim',
        phone: PHONE,
        phoneVerified: true,
        email: 'rahim@example.com',
        lang: 'en',
      });
      const cookie = res.headers['set-cookie']?.[0] ?? '';
      expect(cookie).toMatch(/^bdc_cs=/);
      expect(cookie).toMatch(/HttpOnly/);
      expect(cookie).toMatch(/SameSite=Lax/);
      await agent.get('/v1/customer/me').expect(200);
      const stored = await prisma.customer.findFirstOrThrow();
      expect(stored.passwordHash).toMatch(/^\$argon2id\$/);
    });

    it('rejects an invalid phone and a taken phone', async () => {
      const r = await request(server())
        .post('/v1/customer/auth/otp')
        .send({ phone: '01212345678', purpose: 'signup' })
        .expect(400);
      expect(r.body.code).toBe('PHONE_INVALID');

      await signup();
      await skipCooldown();
      const taken = await request(server())
        .post('/v1/customer/auth/otp')
        .send({ phone: PHONE, purpose: 'signup' })
        .expect(409);
      expect(taken.body.code).toBe('PHONE_TAKEN');
    });

    it('rejects a taken email and a short password', async () => {
      await signup(undefined, { email: 'a@example.com' });
      const second = await signup(undefined, { email: 'A@example.com' }, '01812345678');
      expect(second.res.status).toBe(409);
      expect(second.res.body.code).toBe('EMAIL_TAKEN');

      const short = await signup(undefined, { password: 'short' }, '01912345678');
      expect(short.res.status).toBe(400);
    });

    it('rejects a wrong code and counts the attempt', async () => {
      const agent = request.agent(server());
      await agent.post('/v1/customer/auth/otp').send({ phone: PHONE, purpose: 'signup' });
      const wrong = lastCode() === '000000' ? '000001' : '000000';
      const res = await agent
        .post('/v1/customer/auth/signup')
        .send({ name: 'R', phone: PHONE, password: PASSWORD, code: wrong })
        .expect(400);
      expect(res.body.code).toBe('OTP_INVALID');
      expect((await prisma.otpCode.findFirstOrThrow()).attempts).toBe(1);
    });

    it('rejects an expired code', async () => {
      const agent = request.agent(server());
      await agent.post('/v1/customer/auth/otp').send({ phone: PHONE, purpose: 'signup' });
      await prisma.otpCode.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
      const res = await agent
        .post('/v1/customer/auth/signup')
        .send({ name: 'R', phone: PHONE, password: PASSWORD, code: lastCode() })
        .expect(400);
      expect(res.body.code).toBe('OTP_EXPIRED');
    });

    it('kills the code after 5 wrong attempts, even for the right code', async () => {
      const agent = request.agent(server());
      await agent.post('/v1/customer/auth/otp').send({ phone: PHONE, purpose: 'signup' });
      const right = lastCode();
      const wrong = right === '000000' ? '000001' : '000000';
      for (let i = 0; i < 5; i++) {
        await agent
          .post('/v1/customer/auth/signup')
          .send({ name: 'R', phone: PHONE, password: PASSWORD, code: wrong })
          .expect(400);
      }
      const res = await agent
        .post('/v1/customer/auth/signup')
        .send({ name: 'R', phone: PHONE, password: PASSWORD, code: right })
        .expect(429);
      expect(res.body.code).toBe('TOO_MANY_ATTEMPTS');
    });

    it('codes are single use and only the newest works', async () => {
      const agent = request.agent(server());
      await agent.post('/v1/customer/auth/otp').send({ phone: PHONE, purpose: 'signup' });
      const first = lastCode();
      await skipCooldown();
      await agent.post('/v1/customer/auth/otp').send({ phone: PHONE, purpose: 'signup' });
      const second = lastCode();
      if (first !== second) {
        await agent
          .post('/v1/customer/auth/signup')
          .send({ name: 'R', phone: PHONE, password: PASSWORD, code: first })
          .expect(400);
      }
      await agent
        .post('/v1/customer/auth/signup')
        .send({ name: 'R', phone: PHONE, password: PASSWORD, code: second })
        .expect(200);
      // Replaying a used code fails before anything about the phone is revealed.
      await agent
        .post('/v1/customer/auth/signup')
        .send({ name: 'R', phone: PHONE, password: PASSWORD, code: second })
        .expect(400);
    });

    it('enforces the 60 s resend cooldown', async () => {
      const agent = request.agent(server());
      await agent
        .post('/v1/customer/auth/otp')
        .send({ phone: PHONE, purpose: 'signup' })
        .expect(200);
      const res = await agent
        .post('/v1/customer/auth/otp')
        .send({ phone: PHONE, purpose: 'signup' })
        .expect(429);
      expect(res.body.code).toBe('OTP_COOLDOWN');
      expect(res.body.retryAfterSec).toBeGreaterThan(0);
      expect(sms.outbox).toHaveLength(1);
    });

    it('allows at most 5 codes per phone per hour', async () => {
      for (let i = 0; i < 5; i++) {
        await skipCooldown();
        await request(server())
          .post('/v1/customer/auth/otp')
          .send({ phone: PHONE, purpose: 'signup' })
          .expect(200);
      }
      await skipCooldown();
      const res = await request(server())
        .post('/v1/customer/auth/otp')
        .send({ phone: PHONE, purpose: 'signup' })
        .expect(429);
      expect(res.body.code).toBe('TOO_MANY_REQUESTS');
    });
  });

  describe('login, logout, reset', () => {
    it('logs in by phone (any format) and by email, case-insensitive', async () => {
      await signup(undefined, { email: 'rahim@example.com' });
      await request(server())
        .post('/v1/customer/auth/login')
        .send({ login: '+880 1712-345678', password: PASSWORD })
        .expect(200);
      const byEmail = await request(server())
        .post('/v1/customer/auth/login')
        .send({ login: 'Rahim@Example.com', password: PASSWORD })
        .expect(200);
      expect(byEmail.body.customer.phone).toBe(PHONE);
      expect(byEmail.headers['set-cookie']?.[0]).toMatch(/^bdc_cs=/);
    });

    it('answers wrong password and unknown login identically', async () => {
      await signup();
      const wrong = await request(server())
        .post('/v1/customer/auth/login')
        .send({ login: PHONE, password: 'nope-nope' })
        .expect(401);
      const unknown = await request(server())
        .post('/v1/customer/auth/login')
        .send({ login: '01812345678', password: 'nope-nope' })
        .expect(401);
      expect(wrong.body).toEqual(unknown.body);
      expect(wrong.body.code).toBe('INVALID_CREDENTIALS');
    });

    it('throttles after 5 failed logins, even with the right password', async () => {
      await signup();
      for (let i = 0; i < 5; i++) {
        await request(server())
          .post('/v1/customer/auth/login')
          .send({ login: PHONE, password: 'wrong-wrong' })
          .expect(401);
      }
      const res = await request(server())
        .post('/v1/customer/auth/login')
        .send({ login: PHONE, password: PASSWORD })
        .expect(429);
      expect(res.body.code).toBe('TOO_MANY_REQUESTS');
    });

    it('logout revokes the session', async () => {
      const { agent } = await signup();
      await agent.get('/v1/customer/me').expect(200);
      const out = await agent.post('/v1/customer/auth/logout').expect(200);
      expect(out.body).toEqual({ ok: true });
      expect(await prisma.customerSession.count({ where: { revokedAt: null } })).toBe(0);
      // Replaying the old cookie also fails.
      await request(server()).get('/v1/customer/me').expect(401);
      await agent.get('/v1/customer/me').expect(401);
    });

    it('reset changes the password and revokes every session', async () => {
      const { agent } = await signup();
      await skipCooldown();
      await request(server())
        .post('/v1/customer/auth/otp')
        .send({ phone: PHONE, purpose: 'reset' })
        .expect(200);
      await request(server())
        .post('/v1/customer/auth/reset')
        .send({ phone: PHONE, code: lastCode(), password: 'brand new pass' })
        .expect(200, { ok: true });
      await agent.get('/v1/customer/me').expect(401);
      await request(server())
        .post('/v1/customer/auth/login')
        .send({ login: PHONE, password: PASSWORD })
        .expect(401);
      await request(server())
        .post('/v1/customer/auth/login')
        .send({ login: PHONE, password: 'brand new pass' })
        .expect(200);
    });

    it('reset for an unknown phone looks the same but sends nothing', async () => {
      const unknown = await request(server())
        .post('/v1/customer/auth/otp')
        .send({ phone: '01812345678', purpose: 'reset' })
        .expect(200);
      expect(unknown.body).toEqual({ sentTo: '018******78', expiresInSec: 300, resendInSec: 60 });
      expect(sms.outbox).toHaveLength(0);
      expect(await prisma.otpCode.count()).toBe(0);
      // Cooldown applies equally, so it cannot be used to tell numbers apart.
      await request(server())
        .post('/v1/customer/auth/otp')
        .send({ phone: '01812345678', purpose: 'reset' })
        .expect(429);
      await request(server())
        .post('/v1/customer/auth/reset')
        .send({ phone: '01812345678', code: '123456', password: 'whatever pass' })
        .expect(400);
    });

    it('a signup code cannot be used to reset', async () => {
      await signup();
      await request(server())
        .post('/v1/customer/auth/reset')
        .send({ phone: PHONE, code: lastCode(), password: 'hijack pass1' })
        .expect(400);
    });
  });

  describe('me and sessions', () => {
    it('returns 401 without a session', async () => {
      await request(server()).get('/v1/customer/me').expect(401);
      await request(server()).patch('/v1/customer/me').send({ name: 'x' }).expect(401);
    });

    it('reads and patches the profile', async () => {
      const { agent } = await signup();
      const me = await agent.get('/v1/customer/me').expect(200);
      expect(me.body).toMatchObject({ phone: PHONE, email: null, phoneVerified: true });
      const patched = await agent
        .patch('/v1/customer/me')
        .send({ name: 'Karim', email: 'K@Example.com', lang: 'bn' })
        .expect(200);
      expect(patched.body).toMatchObject({ name: 'Karim', email: 'k@example.com', lang: 'bn' });
      await agent.patch('/v1/customer/me').send({ email: null }).expect(200);
      expect((await agent.get('/v1/customer/me')).body.email).toBeNull();
    });

    it('rejects patching to an email another customer uses', async () => {
      await signup(undefined, { email: 'taken@example.com' });
      const { agent } = await signup(undefined, {}, '01812345678');
      const res = await agent
        .patch('/v1/customer/me')
        .send({ email: 'taken@example.com' })
        .expect(409);
      expect(res.body.code).toBe('EMAIL_TAKEN');
    });

    it('changes the password, keeping only the current session', async () => {
      const { agent } = await signup();
      const other = request.agent(server());
      await other
        .post('/v1/customer/auth/login')
        .send({ login: PHONE, password: PASSWORD })
        .expect(200);
      await agent
        .post('/v1/customer/me/password')
        .send({ currentPassword: 'bad bad bad', newPassword: 'another good one' })
        .expect(401);
      await agent
        .post('/v1/customer/me/password')
        .send({ currentPassword: PASSWORD, newPassword: 'another good one' })
        .expect(200);
      await agent.get('/v1/customer/me').expect(200);
      await other.get('/v1/customer/me').expect(401);
    });

    it('slides the idle window and expires idle sessions', async () => {
      const { agent } = await signup();
      const session = await prisma.customerSession.findFirstOrThrow();
      const old = new Date(Date.now() - 5 * 60_000);
      await prisma.customerSession.update({
        where: { id: session.id },
        data: { lastSeenAt: old, expiresAt: new Date(Date.now() + 60_000) },
      });
      const res = await agent.get('/v1/customer/me').expect(200);
      expect(res.headers['set-cookie']?.[0]).toMatch(/^bdc_cs=.*Max-Age=5184000/);
      const after = await prisma.customerSession.findFirstOrThrow();
      expect(after.expiresAt.getTime()).toBeGreaterThan(Date.now() + 59 * 86_400_000);

      await prisma.customerSession.update({
        where: { id: session.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      await agent.get('/v1/customer/me').expect(401);
    });

    it('rejects disabled customers at login and for existing sessions', async () => {
      const { agent } = await signup();
      await prisma.customer.updateMany({ data: { disabledAt: new Date() } });
      await agent.get('/v1/customer/me').expect(401);
      const login = await request(server())
        .post('/v1/customer/auth/login')
        .send({ login: PHONE, password: PASSWORD })
        .expect(403);
      expect(login.body.code).toBe('ACCOUNT_DISABLED');
    });
  });

  describe('wishlist', () => {
    it('requires a session', async () => {
      await request(server()).get('/v1/customer/wishlist').expect(401);
      await request(server()).get('/v1/customer/wishlist/ids').expect(401);
    });

    it('adds idempotently, lists ids and cards, removes', async () => {
      const { agent } = await signup();
      const p1 = await makeProduct();
      const p2 = await makeProduct();
      await agent.put(`/v1/customer/wishlist/${p1.id}`).expect(200, { ok: true });
      await agent.put(`/v1/customer/wishlist/${p1.id}`).expect(200, { ok: true });
      await agent.put(`/v1/customer/wishlist/${p2.id}`).expect(200);
      expect(await prisma.wishlist.count()).toBe(2);

      const ids = await agent.get('/v1/customer/wishlist/ids').expect(200);
      expect(ids.body.productIds.sort()).toEqual([p1.id, p2.id].sort());

      const list = await agent.get('/v1/customer/wishlist').expect(200);
      expect(list.body.items).toHaveLength(2);
      expect(list.body.items[0]).toMatchObject({
        titleEn: 'Phone',
        priceP: 100000,
        compareAtP: 120000,
        discountPct: 17,
        image: null,
        badges: { isNew: true, isPreorder: false, isUpcoming: false, outOfStock: true },
      });
      expect(list.body.items[0].addedAt).toBeTypeOf('string');

      await agent.delete(`/v1/customer/wishlist/${p1.id}`).expect(200, { ok: true });
      await agent.delete(`/v1/customer/wishlist/${p1.id}`).expect(200);
      expect((await agent.get('/v1/customer/wishlist/ids')).body.productIds).toEqual([p2.id]);
    });

    it('404s for unknown or non-public products and 400s for a bad id', async () => {
      const { agent } = await signup();
      const draft = await makeProduct({ status: 'draft' });
      await agent.put(`/v1/customer/wishlist/${draft.id}`).expect(404);
      await agent.put('/v1/customer/wishlist/00000000-0000-7000-8000-000000000000').expect(404);
      await agent.put('/v1/customer/wishlist/not-a-uuid').expect(400);
    });

    it('is private per customer and hides products that stopped being public', async () => {
      const a = (await signup()).agent;
      const b = (await signup(undefined, {}, '01812345678')).agent;
      const p = await makeProduct();
      await a.put(`/v1/customer/wishlist/${p.id}`).expect(200);
      expect((await b.get('/v1/customer/wishlist/ids')).body.productIds).toEqual([]);
      await prisma.product.update({ where: { id: p.id }, data: { status: 'archived' } });
      expect((await a.get('/v1/customer/wishlist')).body.items).toEqual([]);
    });
  });
});

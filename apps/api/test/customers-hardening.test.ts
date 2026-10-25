import { createHmac } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { All, Controller, Logger, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type Redis from 'ioredis';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { CartService } from '../src/cart/cart.service';
import { clientIp, parseTrustProxy } from '../src/common/client-ip';
import { requestGuard } from '../src/common/request-guard';
import { loadEnv } from '../src/config/env';
import { PrismaService } from '../src/prisma/prisma.service';
import { REDIS } from '../src/redis/redis.module';
import { SmsService } from '../src/sms/sms.service';
import { TestSmsController } from '../src/sms/test-sms.controller';
import {
  addToCart,
  lastOtp,
  makeProduct,
  PASSWORD,
  places,
  resetCommerce,
  signupCustomer,
} from './cart-fixtures';
import { createApp } from './helpers';

const BASE_ENV = {
  DATABASE_URL: 'postgresql://x:y@localhost:5432/z',
  REDIS_URL: 'redis://localhost:6379',
  STAFF_TOTP_KEY: 'a'.repeat(64),
  SMTP_URL: 'smtp://localhost:1025',
  MAIL_FROM: 'a@b.c',
  ADMIN_ORIGIN: 'http://localhost:5173',
  S3_ENDPOINT: 'http://localhost:3900',
  S3_REGION: 'garage',
  S3_BUCKET_PRODUCTS: 'p',
  S3_ACCESS_KEY_ID: 'k',
  S3_SECRET_ACCESS_KEY: 's',
  IMGPROXY_URL: 'http://localhost:8080',
  IMGPROXY_KEY: 'ab',
  IMGPROXY_SALT: 'cd',
};

describe('environment guards', () => {
  it('production needs OTP_SECRET and refuses the e2e OTP endpoint', () => {
    expect(() => loadEnv({ ...BASE_ENV, NODE_ENV: 'production' })).toThrow(/OTP_SECRET/);
    expect(
      loadEnv({ ...BASE_ENV, NODE_ENV: 'production', OTP_SECRET: 'x'.repeat(32) }).OTP_SECRET,
    ).toBe('x'.repeat(32));
    expect(() =>
      loadEnv({
        ...BASE_ENV,
        NODE_ENV: 'production',
        OTP_SECRET: 'x'.repeat(32),
        E2E_EXPOSE_OTP: '1',
      }),
    ).toThrow(/E2E_EXPOSE_OTP/);
    expect(loadEnv({ ...BASE_ENV, DISABLE_2FA: 'true', NODE_ENV: 'development' }).DISABLE_2FA).toBe(
      true,
    );
    expect(() =>
      loadEnv({
        ...BASE_ENV,
        DISABLE_2FA: 'true',
        NODE_ENV: 'production',
        OTP_SECRET: 'x'.repeat(32),
      }),
    ).toThrow(/DISABLE_2FA/);
    expect(loadEnv({ ...BASE_ENV, NODE_ENV: 'development' }).OTP_SECRET).toBeTruthy();
  });

  it('the SMS stub refuses to boot in production', () => {
    const env = loadEnv({ ...BASE_ENV, NODE_ENV: 'production', OTP_SECRET: 'x'.repeat(32) });
    expect(() => new SmsService(env, { send: () => {} } as never)).toThrow(/SMS_PROVIDER/);
  });

  it('only development logs SMS text', () => {
    const log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    const mail = { send: vi.fn() };
    const dev = new SmsService(loadEnv({ ...BASE_ENV, NODE_ENV: 'development' }), mail as never);
    dev.send({ to: '01712345678', text: 'code: 123456' });
    expect(log).toHaveBeenCalledWith(expect.stringContaining('123456'));
    log.mockClear();
    const test = new SmsService(loadEnv({ ...BASE_ENV, NODE_ENV: 'test' }), mail as never);
    test.send({ to: '01712345678', text: 'code: 123456' });
    expect(log).not.toHaveBeenCalled();
    expect(test.lastTo('01712345678')?.text).toBe('code: 123456');
    log.mockRestore();
  });

  it('the e2e SMS endpoint answers 404 unless E2E_EXPOSE_OTP=1', () => {
    const env = loadEnv({ ...BASE_ENV, NODE_ENV: 'test' });
    const sms = new SmsService(env, { send: () => {} } as never);
    sms.send({ to: '01712345678', text: 'code: 654321' });
    expect(() => new TestSmsController(sms, env).lastSms('01712345678')).toThrow(NotFoundException);
    const on = { ...env, E2E_EXPOSE_OTP: '1' as const };
    expect(new TestSmsController(sms, on).lastSms('01712345678')).toEqual({
      to: '01712345678',
      text: 'code: 654321',
    });
    expect(() => new TestSmsController(sms, on).lastSms('01999999999')).toThrow(NotFoundException);
  });
});

describe('client IP', () => {
  const req = (peer: string, headers: Record<string, string> = {}) =>
    ({ socket: { remoteAddress: peer }, headers, ip: '203.0.113.9' }) as never;

  afterEach(() => {
    delete process.env.TRUST_CF_HEADER;
  });

  it('ignores cf-connecting-ip unless explicitly trusted', () => {
    expect(clientIp(req('127.0.0.1', { 'cf-connecting-ip': '1.2.3.4' }))).toBe('203.0.113.9');
  });

  it('trusts it only from a local peer when enabled', () => {
    process.env.TRUST_CF_HEADER = '1';
    expect(clientIp(req('127.0.0.1', { 'cf-connecting-ip': '1.2.3.4' }))).toBe('1.2.3.4');
    expect(clientIp(req('::ffff:10.1.2.3', { 'cf-connecting-ip': '1.2.3.4' }))).toBe('1.2.3.4');
    expect(clientIp(req('198.51.100.7', { 'cf-connecting-ip': '1.2.3.4' }))).toBe('203.0.113.9');
    expect(clientIp(req('127.0.0.1', { 'cf-connecting-ip': 'not-an-ip' }))).toBe('203.0.113.9');
    expect(clientIp(req('127.0.0.1'))).toBe('203.0.113.9');
  });

  it('parses TRUST_PROXY', () => {
    expect(parseTrustProxy('false')).toBe(false);
    expect(parseTrustProxy('true')).toBe(true);
    expect(parseTrustProxy('2')).toBe(2);
    expect(parseTrustProxy('loopback, 10.0.0.0/8')).toBe('loopback, 10.0.0.0/8');
  });
});

@Controller()
class EchoController {
  @All(['v1/{*rest}', 'other'])
  echo() {
    return { ok: true };
  }
}

describe('request guard', () => {
  let guarded: INestApplication;
  let app: ReturnType<INestApplication['getHttpServer']>;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ controllers: [EchoController] }).compile();
    guarded = mod.createNestApplication();
    guarded.use(requestGuard);
    await guarded.init();
    app = guarded.getHttpServer();
  });
  afterAll(() => guarded.close());

  it('requires JSON bodies on mutating /v1 calls', async () => {
    await request(app).post('/v1/x').type('form').send('a=1').expect(415);
    await request(app).post('/v1/x').set('Content-Type', 'text/plain').send('{"a":1}').expect(415);
    await request(app).post('/v1/x').send({ a: 1 }).expect(200);
    await request(app).put('/v1/x').send({ a: 1 }).expect(200);
    await request(app).post('/v1/x').expect(200); // no body, nothing to forge
    await request(app).delete('/v1/x').expect(200);
    await request(app).get('/v1/x').expect(200);
    await request(app).post('/other').type('form').send('a=1').expect(200);
  });

  it('allows multipart only on the upload routes', async () => {
    const part = (path: string) =>
      request(app).post(path).field('alt', 'x').attach('file', Buffer.from('abc'), 'a.png');
    await part('/v1/admin/media').expect(200);
    await part('/v1/admin/products/import').expect(200);
    await part('/v1/admin/products/import/preview').expect(200);
    await part('/v1/customer/me').expect(415);
  });

  it('refuses cross-site browser requests that change data', async () => {
    const res = await request(app)
      .post('/v1/x')
      .set('Sec-Fetch-Site', 'cross-site')
      .send({ a: 1 })
      .expect(403);
    expect(res.body.code).toBe('CROSS_SITE');
    await request(app).post('/v1/x').set('Sec-Fetch-Site', 'same-site').send({}).expect(200);
    await request(app).post('/v1/x').set('Sec-Fetch-Site', 'same-origin').send({}).expect(200);
    await request(app).get('/v1/x').set('Sec-Fetch-Site', 'cross-site').expect(200);
  });
});

describe('customer hardening', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: Redis;
  let sms: SmsService;

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
    redis = app.get<Redis>(REDIS);
    sms = app.get(SmsService);
  });
  beforeEach(() => resetCommerce(app));
  afterAll(() => app.close());
  afterEach(() => vi.restoreAllMocks());

  const server = () => app.getHttpServer();
  const guest = () => request.agent(server());
  const skipCooldown = (phone: string) => redis.del(`cust-otp:cooldown:${phone}`);

  describe('one-time codes', () => {
    it('stores a keyed HMAC, not a bare sha256', async () => {
      const a = guest();
      await a.post('/v1/customer/auth/otp').send({ phone: '01712345678', purpose: 'signup' });
      const code = lastOtp(app);
      const row = await prisma.otpCode.findFirstOrThrow();
      const secret = process.env.OTP_SECRET ?? 'dev-only-otp-secret-not-for-production';
      expect(row.codeHash).toBe(
        createHmac('sha256', secret).update(`01712345678:signup:${code}`).digest('hex'),
      );
    });

    it('locks a phone for an hour after 10 wrong guesses across different codes', async () => {
      const phone = '01712345678';
      const a = guest();
      const attempt = (code: string) =>
        a.post('/v1/customer/auth/signup').send({ name: 'R', phone, password: PASSWORD, code });
      const wrongFor = (right: string) => (right === '000000' ? '000001' : '000000');
      for (let round = 0; round < 2; round++) {
        await skipCooldown(phone);
        await a.post('/v1/customer/auth/otp').send({ phone, purpose: 'signup' }).expect(200);
        for (let i = 0; i < 5; i++) await attempt(wrongFor(lastOtp(app))).expect(400);
      }
      await skipCooldown(phone);
      await a.post('/v1/customer/auth/otp').send({ phone, purpose: 'signup' }).expect(200);
      const locked = await attempt(lastOtp(app)).expect(429);
      expect(locked.body.code).toBe('TOO_MANY_ATTEMPTS');
      expect(locked.body.retryAfterSec).toBeGreaterThan(3500);
      expect(locked.body.retryAfterSec).toBeLessThanOrEqual(3600);
      expect(await prisma.customer.count()).toBe(0);

      // Once the hour is over the phone may try again, and a right code works and clears the count.
      await redis.del(`cust-otp:lock:${phone}:signup`);
      await attempt(lastOtp(app)).expect(200);
      expect(await redis.get(`cust-otp:fail:${phone}:signup`)).toBeNull();
    });

    it('locks for a day at 30 wrong guesses, and a new code does not reset the count', async () => {
      const phone = '01712345678';
      const a = guest();
      await a.post('/v1/customer/auth/otp').send({ phone, purpose: 'signup' }).expect(200);
      const right = lastOtp(app);
      const wrong = right === '000000' ? '000001' : '000000';
      await redis.set(`cust-otp:fail:${phone}:signup`, '29', 'EX', 86_400);
      await a
        .post('/v1/customer/auth/signup')
        .send({ name: 'R', phone, password: PASSWORD, code: wrong })
        .expect(400);
      await skipCooldown(phone);
      await a.post('/v1/customer/auth/otp').send({ phone, purpose: 'signup' }).expect(200);
      const res = await a
        .post('/v1/customer/auth/signup')
        .send({ name: 'R', phone, password: PASSWORD, code: lastOtp(app) })
        .expect(429);
      expect(res.body.code).toBe('TOO_MANY_ATTEMPTS');
      expect(res.body.retryAfterSec).toBeGreaterThan(80_000);
      // The lock is per purpose: password reset for the same number is not affected.
      expect(await redis.exists(`cust-otp:lock:${phone}:reset`)).toBe(0);
    });

    it('a correct code clears the failure count', async () => {
      const a = guest();
      await a.post('/v1/customer/auth/otp').send({ phone: '01712345678', purpose: 'signup' });
      const right = lastOtp(app);
      await a
        .post('/v1/customer/auth/signup')
        .send({
          name: 'R',
          phone: '01712345678',
          password: PASSWORD,
          code: right === '000000' ? '000001' : '000000',
        })
        .expect(400);
      expect(await redis.get('cust-otp:fail:01712345678:signup')).toBe('1');
      await a
        .post('/v1/customer/auth/signup')
        .send({ name: 'R', phone: '01712345678', password: PASSWORD, code: right })
        .expect(200);
      expect(await redis.get('cust-otp:fail:01712345678:signup')).toBeNull();
    });

    it('prunes code rows older than a day when a new code is written', async () => {
      const old = new Date(Date.now() - 2 * 86_400_000);
      await prisma.otpCode.create({
        data: {
          phone: '01999999999',
          purpose: 'signup',
          codeHash: 'x',
          expiresAt: old,
          createdAt: old,
        },
      });
      await guest().post('/v1/customer/auth/otp').send({ phone: '01712345678', purpose: 'signup' });
      expect(await prisma.otpCode.count()).toBe(1);
      expect(await prisma.otpCode.count({ where: { phone: '01999999999' } })).toBe(0);
    });
  });

  describe('enumeration', () => {
    it('counts every OTP request per IP, taken phone or not', async () => {
      await signupCustomer(app, guest(), '01712345678');
      await redis.flushdb();
      let last = 0;
      const a = guest();
      for (let i = 0; i < 21; i++) {
        last = (
          await a.post('/v1/customer/auth/otp').send({ phone: '01712345678', purpose: 'signup' })
        ).status;
        if (i < 20) expect(last).toBe(409);
      }
      expect(last).toBe(429);
    });

    it('signup checks the code before saying a phone is registered', async () => {
      await signupCustomer(app, guest(), '01712345678');
      const res = await guest()
        .post('/v1/customer/auth/signup')
        .send({ name: 'X', phone: '01712345678', password: PASSWORD, code: '123456' })
        .expect(400);
      expect(res.body.code).toBe('OTP_INVALID');
    });

    it('limits email changes per customer', async () => {
      const a = guest();
      await signupCustomer(app, a, '01712345678');
      for (let i = 0; i < 5; i++) {
        await a
          .patch('/v1/customer/me')
          .send({ email: `n${i}@example.com` })
          .expect(200);
      }
      const res = await a.patch('/v1/customer/me').send({ email: 'n9@example.com' }).expect(429);
      expect(res.body.code).toBe('TOO_MANY_REQUESTS');
      // Name changes are not email changes.
      await a.patch('/v1/customer/me').send({ name: 'Karim' }).expect(200);
    });

    it('throttles wrong current passwords per customer', async () => {
      const a = guest();
      await signupCustomer(app, a, '01712345678');
      const change = (currentPassword: string) =>
        a
          .post('/v1/customer/me/password')
          .send({ currentPassword, newPassword: 'another good one' });
      for (let i = 0; i < 5; i++) await change('wrong wrong').expect(401);
      const res = await change(PASSWORD).expect(429);
      expect(res.body.code).toBe('TOO_MANY_REQUESTS');
    });
  });

  describe('sessions and caching', () => {
    it('treats a non-string session cookie as signed out', async () => {
      await request(server()).get('/v1/customer/me').set('Cookie', 'bdc_cs=j:{"a":1}').expect(401);
      await request(server()).get('/v1/cart').set('Cookie', 'bdc_cs=j:{"a":1}').expect(200);
    });

    it('marks personal responses private, no-store, errors included', async () => {
      const a = guest();
      const check = (res: { headers: Record<string, string> }) =>
        expect(res.headers['cache-control']).toBe('private, no-store');
      check(await a.get('/v1/cart'));
      check(await a.get('/v1/customer/me').expect(401));
      check(await a.get('/v1/customer/wishlist').expect(401));
      check(await a.get('/v1/customer/orders').expect(401));
      check(await a.get('/v1/customer/addresses').expect(401));
      const p = await places(app);
      check(await a.post('/v1/checkout/quote').send(p.dhaka));
      check(await a.post('/v1/customer/auth/otp').send({ phone: 'x', purpose: 'signup' }));
      // Public catalog data stays cacheable.
      const geo = await a.get('/v1/public/geo/divisions');
      expect(geo.headers['cache-control']).toBe('public, max-age=86400');
    });
  });

  describe('carts', () => {
    it('limits new anonymous carts per IP', { timeout: 60_000 }, async () => {
      const { variant } = await makeProduct(app, { stock: 50 });
      const keeper = guest();
      await addToCart(keeper, variant.id);
      for (let i = 1; i < 30; i++) await addToCart(guest(), variant.id);
      const res = await guest().put(`/v1/cart/items/${variant.id}`).send({ qty: 1 }).expect(429);
      expect(res.body.code).toBe('TOO_MANY_REQUESTS');
      // An existing cart keeps working.
      await keeper.put(`/v1/cart/items/${variant.id}`).send({ qty: 2 }).expect(200);
    });
  });

  describe('placing orders', () => {
    const body = async (key: string, extra: Record<string, unknown> = {}) => {
      const p = await places(app);
      return {
        address: { name: 'Karim', phone: '01811111111', ...p.dhaka, line: 'Road 1, House 2' },
        guest: { name: 'Karim', phone: '01811111111' },
        lang: 'en',
        idempotencyKey: key,
        ...extra,
      };
    };

    it('one cart makes one order even with two different idempotency keys', async () => {
      const { variant } = await makeProduct(app, { stock: 5 });
      const a = guest();
      await addToCart(a, variant.id, 2);
      const [r1, r2] = await Promise.all([
        a.post('/v1/checkout/place').send(await body('race-key-aaaa-1')),
        a.post('/v1/checkout/place').send(await body('race-key-bbbb-2')),
      ]);
      expect([r1.status, r2.status].sort()).toEqual([200, 409]);
      const loser = r1.status === 409 ? r1 : r2;
      expect(loser.body.code).toBe('CART_EMPTY');
      expect(await prisma.order.count()).toBe(1);
      expect(
        (await prisma.inventory.findUniqueOrThrow({ where: { variantId: variant.id } })).reserved,
      ).toBe(2);
    });

    it('asks for the OTP when the total grew past the threshold after the pre-check', async () => {
      const { variant } = await makeProduct(app, { priceP: 100_000, stock: 5 });
      const a = guest();
      await addToCart(a, variant.id);
      const cart = app.get(CartService);
      const real = cart.lines.bind(cart);
      let calls = 0;
      vi.spyOn(cart, 'lines').mockImplementation(async (db, cartId) => {
        const lines = await real(db, cartId);
        // Second read (inside the transaction): the price jumped above ৳5000.
        return ++calls >= 2 ? lines.map((l) => ({ ...l, unitPriceP: 900_000 })) : lines;
      });
      const res = await a
        .post('/v1/checkout/place')
        .send(await body('otp-recheck-key-1'))
        .expect(400);
      expect(res.body.code).toBe('OTP_REQUIRED');
      expect(await prisma.order.count()).toBe(0);
      expect(await prisma.stockMovement.count({ where: { reason: 'order_reserve' } })).toBe(0);
      expect(sms.outbox).toHaveLength(0);
    });
  });
});

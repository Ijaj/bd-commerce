import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from './helpers';

describe('geo', () => {
  let app: INestApplication;
  beforeAll(async () => {
    app = await createApp();
  });
  afterAll(() => app.close());

  it('lists 8 divisions with both names and a day of caching', async () => {
    const res = await request(app.getHttpServer()).get('/v1/public/geo/divisions').expect(200);
    expect(res.body).toHaveLength(8);
    expect(res.body[0]).toEqual({
      id: expect.any(Number),
      nameEn: expect.any(String),
      nameBn: expect.any(String),
    });
    expect(res.headers['cache-control']).toBe('public, max-age=86400');
  });

  it('returns divisions in stable id order with one spelling of Chattogram', async () => {
    const res = await request(app.getHttpServer()).get('/v1/public/geo/divisions').expect(200);
    const ids = res.body.map((d: { id: number }) => d.id);
    expect(ids).toEqual([...ids].sort((a: number, b: number) => a - b));
    const names = res.body.map((d: { nameEn: string }) => d.nameEn);
    expect(names).toContain('Chattogram');
    expect(names).not.toContain('Chattagram');
    const districts = await request(app.getHttpServer())
      .get('/v1/public/geo/districts')
      .expect(200);
    expect(districts.body.map((d: { nameEn: string }) => d.nameEn)).toContain('Chattogram');
  });

  it('lists 64 districts, filtered by division', async () => {
    const all = await request(app.getHttpServer()).get('/v1/public/geo/districts').expect(200);
    expect(all.body).toHaveLength(64);
    const div = all.body[0].divisionId;
    const some = await request(app.getHttpServer())
      .get(`/v1/public/geo/districts?divisionId=${div}`)
      .expect(200);
    expect(some.body.length).toBeGreaterThan(0);
    expect(some.body.every((d: { divisionId: number }) => d.divisionId === div)).toBe(true);
  });

  it('lists upazilas of a district, including Dhaka city thanas', async () => {
    const dhaka = await request(app.getHttpServer())
      .get('/v1/public/geo/upazilas?districtId=47')
      .expect(200);
    const names = dhaka.body.map((u: { nameEn: string }) => u.nameEn);
    expect(names).toContain('Savar');
    expect(names).toContain('Gulshan');
    expect(dhaka.body[0]).toMatchObject({ districtId: 47, nameBn: expect.any(String) });
    await request(app.getHttpServer()).get('/v1/public/geo/upazilas').expect(400);
  });
});

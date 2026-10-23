// Writes the OpenAPI spec without starting the server: node dist/openapi-emit.js <out.json>
import 'reflect-metadata';
import { writeFileSync } from 'node:fs';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { buildOpenApiDoc, configureApp } from './setup';

async function emit(out: string) {
  // Only builds the module graph; env values just need to parse.
  process.env.DATABASE_URL ??= 'postgresql://openapi@localhost/openapi';
  process.env.REDIS_URL ??= 'redis://localhost:6379';
  process.env.STAFF_TOTP_KEY ??= '0'.repeat(64);
  process.env.SMTP_URL ??= 'smtp://localhost:1025';
  process.env.MAIL_FROM ??= 'openapi@localhost';
  process.env.ADMIN_ORIGIN ??= 'http://localhost:5173';
  const app = await NestFactory.create(AppModule, { logger: false });
  configureApp(app);
  writeFileSync(out, `${JSON.stringify(buildOpenApiDoc(app), null, 2)}\n`);
}

const out = process.argv[2];
if (!out) throw new Error('usage: openapi-emit <out.json>');
void emit(out);

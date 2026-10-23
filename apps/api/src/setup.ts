import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import { ENV, type Env } from './config/env';

/** App-wide HTTP setup shared by main, tests and the OpenAPI emitter. */
export function configureApp(app: INestApplication) {
  const env = app.get<Env>(ENV);
  app.setGlobalPrefix('v1', { exclude: ['health'] });
  app.use(cookieParser());
  app.enableCors({ origin: env.ADMIN_ORIGIN, credentials: true });
  app.enableShutdownHooks();
}

export function buildOpenApiDoc(app: INestApplication) {
  const config = new DocumentBuilder().setTitle('bd-commerce API').setVersion('1').build();
  return cleanupOpenApiDoc(SwaggerModule.createDocument(app, config));
}

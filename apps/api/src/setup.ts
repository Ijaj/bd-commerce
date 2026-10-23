import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, type OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
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
  const config = new DocumentBuilder()
    .setTitle('bd-commerce API')
    .setVersion('1')
    // 3.1 keeps zod's nullable types (type: [T, 'null']) intact; 3.0 turned them into arrays.
    .setOpenAPIVersion('3.1.0')
    .build();
  return cleanupOpenApiDoc(restoreNullableTypes(SwaggerModule.createDocument(app, config)));
}

/**
 * nestjs-zod hands Nest zod's `type: ['string', 'null']`, which Nest's schema factory turns into
 * `type: 'array', items: { type: 'string' }`. The property keeps nestjs-zod's empty-type marker,
 * so restore the nullable type before cleanupOpenApiDoc strips the marker.
 */
function restoreNullableTypes(doc: OpenAPIObject) {
  for (const schema of Object.values(doc.components?.schemas ?? {})) {
    const properties = (schema as { properties?: Record<string, Record<string, unknown>> })
      .properties;
    for (const p of Object.values(properties ?? {})) {
      const items = p.items as Record<string, unknown> | undefined;
      if (
        p['x-nestjs_zod-empty-type'] === true &&
        p.type === 'array' &&
        items &&
        typeof items.type === 'string' &&
        Object.keys(items).length === 1
      ) {
        p.type = [items.type, 'null'];
        delete p.items;
      }
    }
  }
  return doc;
}

import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';

/** App-wide HTTP setup shared by main, tests and the OpenAPI emitter. */
export function configureApp(app: INestApplication) {
  app.setGlobalPrefix('v1', { exclude: ['health'] });
  app.enableShutdownHooks();
}

export function buildOpenApiDoc(app: INestApplication) {
  const config = new DocumentBuilder().setTitle('bd-commerce API').setVersion('1').build();
  return cleanupOpenApiDoc(SwaggerModule.createDocument(app, config));
}

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { parseTrustProxy } from './common/client-ip';
import { requestGuard } from './common/request-guard';
import { ENV, type Env } from './config/env';
import { buildOpenApiDoc, configureApp } from './setup';

try {
  process.loadEnvFile('../../.env');
} catch {
  // no .env (CI, production): variables come from the environment
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const env = app.get<Env>(ENV);
  // Explicit, never the Express default of "whatever the client says": see clientIp().
  app.set('trust proxy', parseTrustProxy(env.TRUST_PROXY));
  app.use(requestGuard);
  configureApp(app);
  if (env.NODE_ENV !== 'production') {
    SwaggerModule.setup('docs', app, buildOpenApiDoc(app));
  }
  await app.listen(env.PORT, env.HOST ?? (env.NODE_ENV === 'production' ? '127.0.0.1' : '0.0.0.0'));
}

void bootstrap();

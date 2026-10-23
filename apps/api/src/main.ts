import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ENV, type Env } from './config/env';
import { buildOpenApiDoc, configureApp } from './setup';

try {
  process.loadEnvFile('../../.env');
} catch {
  // no .env (CI, production): variables come from the environment
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  const env = app.get<Env>(ENV);
  if (env.NODE_ENV !== 'production') {
    SwaggerModule.setup('docs', app, buildOpenApiDoc(app));
  }
  await app.listen(env.PORT);
}

void bootstrap();

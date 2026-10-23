import { defineConfig, env } from 'prisma/config';

try {
  process.loadEnvFile('../../.env');
} catch {
  // no .env (CI, production): variables come from the environment
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: env('DATABASE_URL') },
});

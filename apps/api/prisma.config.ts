import { defineConfig } from 'prisma/config';

try {
  process.loadEnvFile('../../.env');
} catch {
  // no .env (CI, production): variables come from the environment
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // Not env(): that throws when unset, and `prisma generate` (build, CI) needs no database.
  datasource: { url: process.env.DATABASE_URL ?? '' },
});

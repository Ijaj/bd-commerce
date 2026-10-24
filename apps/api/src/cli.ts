// Server-side admin commands (need DB access):
//   node dist/cli.js create-owner <email> <name>   first Owner account, prints a temporary password
//   node dist/cli.js reset-2fa <email>             last-resort 2FA reset (C14)
//   node dist/cli.js seed-demo                     dev-only demo catalog (refused in production)
//   node dist/cli.js sync-couriers                 poll couriers for open shipments (run on a schedule)
//   node dist/cli.js complete-orders               complete delivered orders whose return window has passed
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { z } from 'zod';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';
import { ReturnsCompletionService } from './returns/returns-completion.service';
import { seedDemoCatalog } from './seed/demo-catalog';
import { ShipmentSyncService } from './shipments/shipment-sync.service';
import { StaffService } from './staff/staff.service';

try {
  process.loadEnvFile('../../.env');
} catch {
  // no .env: variables come from the environment
}

async function run([command, ...args]: string[]) {
  if (command === 'seed-demo' && process.env.NODE_ENV === 'production') {
    throw new Error('seed-demo is dev-only and refuses to run when NODE_ENV=production');
  }
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const staff = app.get(StaffService);
    if (command === 'create-owner' && args[0] && args[1]) {
      const parsed = z.email().safeParse(args[0]);
      if (!parsed.success) throw new Error(`Not a valid email: ${args[0]}`);
      const email = parsed.data;
      const { staff: owner, tempPassword } = await staff.createOwner(
        email,
        args.slice(1).join(' '),
      );
      console.log(`Owner created: ${owner.email}\nTemporary password: ${tempPassword}`);
      console.log('Sign in to the admin panel, set up 2FA, then change the password.');
    } else if (command === 'reset-2fa' && args[0]) {
      const reset = await staff.resetTotp(null, await staff.findIdByEmail(args[0]));
      console.log(`2FA reset for ${reset.email}; all their sessions were signed out.`);
    } else if (command === 'seed-demo') {
      await seedDemoCatalog(app.get(PrismaService));
    } else if (command === 'sync-couriers') {
      console.log(await app.get(ShipmentSyncService).syncOpen());
    } else if (command === 'complete-orders') {
      console.log(`completed ${await app.get(ReturnsCompletionService).completeDue()} orders`);
    } else {
      console.error(
        'usage: cli create-owner <email> <name> | reset-2fa <email> | seed-demo | sync-couriers | complete-orders',
      );
      process.exitCode = 1;
    }
  } finally {
    await app.close();
  }
}

run(process.argv.slice(2)).catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});

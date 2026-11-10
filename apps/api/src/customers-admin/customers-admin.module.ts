import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CustomersAdminController } from './customers-admin.controller';
import { CustomersAdminService } from './customers-admin.service';

/** Admin view of storefront customers: profile, notes, block (A6, C88). */
@Module({
  imports: [AuthModule],
  controllers: [CustomersAdminController],
  providers: [CustomersAdminService],
})
export class CustomersAdminModule {}

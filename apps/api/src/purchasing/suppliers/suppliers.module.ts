import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { SupplierLedgerService } from './supplier-ledger.service';
import { SupplierLinksService } from './supplier-links.service';
import { SupplierLedgerController, SuppliersController } from './suppliers.controller';
import { SuppliersService } from './suppliers.service';

/** Step 7a: suppliers, variant↔supplier links, payables ledger (C65, C73, C74, C76, C77). */
@Module({
  imports: [AuthModule],
  controllers: [SuppliersController, SupplierLedgerController],
  providers: [SuppliersService, SupplierLinksService, SupplierLedgerService],
  exports: [SuppliersService, SupplierLedgerService],
})
export class SuppliersModule {}

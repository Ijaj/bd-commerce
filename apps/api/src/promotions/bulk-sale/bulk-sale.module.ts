import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { BulkSaleController } from './bulk-sale.controller';
import { BulkSaleService } from './bulk-sale.service';

/** Step 6: bulk sale tool, C58 (sale prices on many variants, undoable). */
@Module({
  imports: [AuthModule],
  controllers: [BulkSaleController],
  providers: [BulkSaleService],
})
export class BulkSaleModule {}

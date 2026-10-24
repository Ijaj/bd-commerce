import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CustomerCoreModule } from '../customers/customer-core.module';
import { DocumentsAdminController, DocumentsCustomerController } from './documents.controller';
import { InvoicesService } from './invoices.service';
import { LabelsService } from './labels.service';

/** Step 5: invoices (VAT-inclusive, frozen snapshot) and shipping-label print data. */
@Module({
  imports: [AuthModule, CustomerCoreModule],
  controllers: [DocumentsAdminController, DocumentsCustomerController],
  providers: [InvoicesService, LabelsService],
  exports: [InvoicesService],
})
export class DocumentsModule {}

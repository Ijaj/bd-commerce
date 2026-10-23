import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { InventoryModule } from '../../inventory/inventory.module';
import { CategoriesModule } from '../categories/categories.module';
import { ProductsModule } from '../products/products.module';
import { ExportService } from './export.service';
import { ImportService } from './import.service';
import { ImportExportController } from './import-export.controller';

@Module({
  imports: [AuthModule, ProductsModule, CategoriesModule, InventoryModule],
  controllers: [ImportExportController],
  providers: [ExportService, ImportService],
})
export class ImportExportModule {}

import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { VariantsService } from './variants.service';

@Module({
  imports: [AuthModule],
  controllers: [ProductsController],
  providers: [ProductsService, VariantsService],
  exports: [ProductsService, VariantsService],
})
export class ProductsModule {}

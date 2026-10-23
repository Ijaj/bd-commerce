import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { AttributesController, CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';

@Module({
  imports: [AuthModule],
  controllers: [CategoriesController, AttributesController],
  providers: [CategoriesService],
  exports: [CategoriesService],
})
export class CategoriesModule {}

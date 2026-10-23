import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RolesService } from './roles.service';
import { PermissionsController, RolesController, StaffController } from './staff.controller';
import { StaffService } from './staff.service';

@Module({
  imports: [AuthModule],
  controllers: [StaffController, RolesController, PermissionsController],
  providers: [StaffService, RolesService],
  exports: [StaffService],
})
export class StaffModule {}

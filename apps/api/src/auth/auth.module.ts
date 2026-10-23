import { Module } from '@nestjs/common';
import { RbacService } from './rbac.service';
import { StaffAuthController } from './staff-auth.controller';
import { StaffAuthGuard } from './staff-auth.guard';
import { StaffAuthService } from './staff-auth.service';
import { ThrottleService } from './throttle.service';

@Module({
  controllers: [StaffAuthController],
  providers: [StaffAuthService, StaffAuthGuard, RbacService, ThrottleService],
  exports: [StaffAuthService, StaffAuthGuard, RbacService],
})
export class AuthModule {}

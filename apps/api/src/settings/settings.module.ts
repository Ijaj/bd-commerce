import { Global, type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MaintenanceMiddleware } from './maintenance.middleware';
import { SettingsController, SiteController } from './settings.controller';
import { SettingsService } from './settings.service';

@Global()
@Module({
  imports: [AuthModule],
  controllers: [SettingsController, SiteController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(MaintenanceMiddleware).forRoutes('*path');
  }
}

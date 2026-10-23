import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';

// Stub created before step 2 agents started; owner fills it in.
@Module({
  imports: [AuthModule],
  controllers: [],
  providers: [],
})
export class MediaModule {}

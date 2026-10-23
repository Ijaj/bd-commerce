import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ENV, type Env } from '../config/env';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { MemoryObjectStorage, ObjectStorage, S3ObjectStorage } from './object-storage';

@Module({
  imports: [AuthModule],
  controllers: [MediaController],
  providers: [
    MediaService,
    {
      provide: ObjectStorage,
      inject: [ENV],
      useFactory: (env: Env): ObjectStorage =>
        env.NODE_ENV === 'test' ? new MemoryObjectStorage() : new S3ObjectStorage(env),
    },
  ],
  exports: [MediaService, ObjectStorage],
})
export class MediaModule {}

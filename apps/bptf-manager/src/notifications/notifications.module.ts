import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { RedisModule } from '@songkeys/nestjs-redis';
import { TokensModule } from '../tokens/tokens.module';
import { BullModule } from '@nestjs/bullmq';
import { DefaultJobOptions } from 'bullmq';
import { NotificationsProcessor } from './notifications.processor';

const defaultJobOptions: DefaultJobOptions = {
  attempts: Number.MAX_SAFE_INTEGER,
  backoff: {
    type: 'exponential',
    delay: 500,
  },
  removeOnComplete: true,
  removeOnFail: true,
};

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'notifications',
      defaultJobOptions,
    }),
    RedisModule,
    TokensModule,
  ],
  providers: [NotificationsService, NotificationsProcessor],
  controllers: [NotificationsController],
  exports: [NotificationsService],
})
export class NotificationsModule {}

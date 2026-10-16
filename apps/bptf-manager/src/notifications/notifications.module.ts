import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { RedisModule } from '@liaoliaots/nestjs-redis';
import { TokensModule } from '../tokens/tokens.module';
import { BullModule } from '@nestjs/bullmq';
import { defaultJobOptions } from '@tf2-automatic/queue';
import { NotificationsProcessor } from './notifications.processor';

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

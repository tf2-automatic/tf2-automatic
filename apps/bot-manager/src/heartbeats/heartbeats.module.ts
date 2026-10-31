import { RedisModule } from '@liaoliaots/nestjs-redis';
import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { OfflineBotJobsService } from '@tf2-automatic/queue';
import { HeartbeatsController } from './heartbeats.controller';
import { HeartbeatsService } from './heartbeats.service';
import { BullModule } from '@nestjs/bullmq';
import { HeartbeatsProcessor } from './heartbeats.processor';

@Module({
  imports: [
    RedisModule,
    DiscoveryModule,
    BullModule.registerQueue({
      name: 'heartbeats',
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: true,
        removeOnFail: true,
      },
    }),
  ],
  controllers: [HeartbeatsController],
  providers: [HeartbeatsService, HeartbeatsProcessor, OfflineBotJobsService],
  exports: [HeartbeatsService],
})
export class HeartbeatsModule {}

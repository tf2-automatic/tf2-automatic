import { RedisModule } from '@songkeys/nestjs-redis';
import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { HeartbeatsController } from './heartbeats.controller';
import { HeartbeatsService } from './heartbeats.service';
import { BullModule } from '@nestjs/bullmq';
import { HeartbeatsProcessor } from './heartbeats.processor';

@Module({
  imports: [
    RedisModule,
    HttpModule,
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
  providers: [HeartbeatsService, HeartbeatsProcessor],
  exports: [HeartbeatsService],
})
export class HeartbeatsModule {}

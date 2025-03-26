import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { HeartbeatsModule } from '../heartbeats/heartbeats.module';
import { TradesService } from './trades.service';
import { TradesController } from './trades.controller';
import { TradesProcessor } from './processors/trades.processor';
import { defaultJobOptions } from '../common/utils/default-job-options';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'trades',
      defaultJobOptions,
    }),
    HeartbeatsModule,
  ],
  providers: [TradesService, TradesProcessor],
  controllers: [TradesController],
})
export class TradesModule {}

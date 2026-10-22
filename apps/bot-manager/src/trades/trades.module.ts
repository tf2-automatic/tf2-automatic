import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { HeartbeatsModule } from '../heartbeats/heartbeats.module';
import { TradesService } from './trades.service';
import { TradesController } from './trades.controller';
import { TradesProcessor } from './trades.processor';
import { ExchangeDetailsProcessor } from './exchange-details.processor';
import { defaultJobOptions } from '@tf2-automatic/queue';
import { ClsModule } from 'nestjs-cls';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'trades',
      defaultJobOptions,
    }),
    BullModule.registerQueue({
      name: 'exchange-details',
      defaultJobOptions,
    }),
    HeartbeatsModule,
    ClsModule.forFeature(),
  ],
  providers: [TradesService, TradesProcessor, ExchangeDetailsProcessor],
  controllers: [TradesController],
})
export class TradesModule {}

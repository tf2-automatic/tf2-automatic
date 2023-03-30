import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { HeartbeatsModule } from '../heartbeats/heartbeats.module';
import { RabbitMQWrapperModule } from '../rabbitmq-wrapper/rabbitmq-wrapper.module';
import { ExchangeDetailsProcessor } from './processors/exchange-details.processor';
import { TradesService } from './trades.service';
import { TradesController } from './trades.controller';
import { DefaultJobOptions } from 'bullmq';
import { TradesProcessor } from './processors/trades.processor';

const defaultJobOptions: DefaultJobOptions = {
  attempts: Number.MAX_SAFE_INTEGER,
  backoff: {
    type: 'custom',
  },
  removeOnComplete: true,
  removeOnFail: true,
};

@Module({
  imports: [
    EventsModule,
    RabbitMQWrapperModule,
    BullModule.registerQueue({
      name: 'getExchangeDetails',
      defaultJobOptions,
    }),
    BullModule.registerQueue({
      name: 'trades',
      defaultJobOptions,
    }),
    HeartbeatsModule,
    HttpModule,
  ],
  providers: [TradesService, ExchangeDetailsProcessor, TradesProcessor],
  controllers: [TradesController],
})
export class TradesModule {}

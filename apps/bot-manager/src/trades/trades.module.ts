import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { HeartbeatsModule } from '../heartbeats/heartbeats.module';
import { RabbitMQWrapperModule } from '../rabbitmq-wrapper/rabbitmq-wrapper.module';
import { ExchangeDetailsProcessor } from './exchange-details.processor';
import { TradesService } from './trades.service';

@Module({
  imports: [
    EventsModule,
    RabbitMQWrapperModule,
    BullModule.registerQueue({
      name: 'getExchangeDetails',
      defaultJobOptions: {
        attempts: Number.MAX_SAFE_INTEGER,
        backoff: {
          type: 'exponential',
          delay: 10000,
        },
        removeOnComplete: true,
        removeOnFail: true,
      },
    }),
    HeartbeatsModule,
    HttpModule,
  ],
  providers: [TradesService, ExchangeDetailsProcessor],
})
export class TradesModule {}

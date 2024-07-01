import { Global, Module } from '@nestjs/common';
import { MetadataModule } from '../metadata/metadata.module';
import { NestEventsModule } from '@tf2-automatic/nestjs-events';
import { getEventsConfig } from '@tf2-automatic/config';
import { BOT_EXCHANGE_NAME } from '@tf2-automatic/bot-data';
import { EventsService } from './events.service';

@Global()
@Module({
  imports: [
    MetadataModule,
    NestEventsModule.forRoot({
      publishingExchange: BOT_EXCHANGE_NAME,
      subscriberExchanges: [],
      config: getEventsConfig(),
    }),
  ],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}

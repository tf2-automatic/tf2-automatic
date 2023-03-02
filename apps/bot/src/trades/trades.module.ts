import { Module } from '@nestjs/common';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import {
  makeCounterProvider,
  makeGaugeProvider,
} from '@willsoto/nestjs-prometheus';
import { BotModule } from '../bot/bot.module';
import { EventsModule } from '../events/events.module';
import { TradesController } from './trades.controller';
import { TradesService } from './trades.service';

@Module({
  imports: [BotModule, EventsModule, PrometheusModule],
  controllers: [TradesController],
  providers: [
    TradesService,
    makeCounterProvider({
      name: 'bot_offers_sent_total',
      help: 'Amount of trades sent by the bot since last restart',
    }),
    makeCounterProvider({
      name: 'bot_offers_received_total',
      help: 'Amount of trades received by the bot since last restart',
    }),
    makeGaugeProvider({
      name: 'bot_polldata_size_bytes',
      help: 'The size of the polldata file in bytes',
    }),
    makeGaugeProvider({
      name: 'bot_asset_cache_size',
      help: 'The amount of assets in the cache',
    }),
  ],
})
export class TradesModule {}

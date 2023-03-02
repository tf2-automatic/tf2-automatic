import { Module } from '@nestjs/common';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import {
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
    makeGaugeProvider({
      name: 'bot_polldata_size_bytes',
      help: 'The size of the polldata file in bytes',
    }),
  ],
})
export class TradesModule {}

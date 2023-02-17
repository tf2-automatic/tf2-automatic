import { Module } from '@nestjs/common';
import { BotModule } from '../bot/bot.module';
import { EventsModule } from '../events/events.module';
import { TradesController } from './trades.controller';
import { TradesService } from './trades.service';

@Module({
  imports: [BotModule, EventsModule],
  controllers: [TradesController],
  providers: [TradesService],
})
export class TradesModule {}

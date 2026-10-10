import { Module } from '@nestjs/common';
import { BotModule } from '../bot/bot.module';
import { TradesController } from './trades.controller';
import { TradesService } from './trades.service';
import { GarbageCollectorService } from './gc.service';

@Module({
  imports: [BotModule],
  controllers: [TradesController],
  providers: [TradesService, GarbageCollectorService],
  exports: [TradesService],
})
export class TradesModule {}

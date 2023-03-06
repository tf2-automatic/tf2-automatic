import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { BotModule } from '../bot/bot.module';
import { BotHealthIndicator } from './bot.health';

@Module({
  imports: [TerminusModule, BotModule],
  controllers: [HealthController],
  providers: [BotHealthIndicator],
})
export class HealthModule {}

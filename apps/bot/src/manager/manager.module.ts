import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { BotModule } from '../bot/bot.module';
import { ManagerService } from './manager.service';

@Module({
  imports: [HttpModule, BotModule],
  providers: [ManagerService],
})
export class ManagerModule {}

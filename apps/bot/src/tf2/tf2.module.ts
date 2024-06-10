import { Module } from '@nestjs/common';
import { BotModule } from '../bot/bot.module';
import { TF2Controller } from './tf2.controller';
import { TF2Service } from './tf2.service';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [StorageModule, BotModule],
  controllers: [TF2Controller],
  providers: [TF2Service],
})
export class TF2Module {}

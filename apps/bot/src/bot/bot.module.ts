import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { BotService } from './bot.service';

@Module({
  imports: [StorageModule],
  providers: [BotService],
})
export class BotModule {}

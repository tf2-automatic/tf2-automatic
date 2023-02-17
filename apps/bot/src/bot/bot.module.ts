import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { MetadataModule } from '../metadata/metadata.module';
import { StorageModule } from '../storage/storage.module';
import { BotService } from './bot.service';

@Module({
  imports: [StorageModule, EventsModule, MetadataModule],
  providers: [BotService],
  exports: [BotService],
})
export class BotModule {}

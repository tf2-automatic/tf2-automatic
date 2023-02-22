import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { MetadataModule } from '../metadata/metadata.module';
import { ShutdownModule } from '../shutdown/shutdown.module';
import { StorageModule } from '../storage/storage.module';
import { BotService } from './bot.service';

@Module({
  imports: [StorageModule, EventsModule, MetadataModule, ShutdownModule],
  providers: [BotService],
  exports: [BotService],
})
export class BotModule {}

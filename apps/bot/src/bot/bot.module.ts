import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { MetadataModule } from '../metadata/metadata.module';
import { ShutdownModule } from '../shutdown/shutdown.module';
import { StorageModule } from '../storage/storage.module';
import { BotService } from './bot.service';
import { BotController } from './bot.controller';

@Module({
  imports: [StorageModule, EventsModule, MetadataModule, ShutdownModule],
  providers: [BotService],
  controllers: [BotController],
  exports: [BotService],
})
export class BotModule {}

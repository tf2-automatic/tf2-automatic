import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { MetadataModule } from '../metadata/metadata.module';
import { ShutdownModule } from '../shutdown/shutdown.module';
import { StorageModule } from '../storage/storage.module';
import { BotService } from './bot.service';
import { BotController } from './bot.controller';
import { makeSummaryProvider } from '@willsoto/nestjs-prometheus';

@Module({
  imports: [StorageModule, EventsModule, MetadataModule, ShutdownModule],
  providers: [
    BotService,
    makeSummaryProvider({
      name: 'steam_api_request_duration_seconds',
      help: 'The duration of Steam API requests in seconds',
      labelNames: ['method', 'url', 'status'],
    }),
  ],
  controllers: [BotController],
  exports: [BotService],
})
export class BotModule {}

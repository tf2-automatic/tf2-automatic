import { Module } from '@nestjs/common';
import { MetadataModule } from '../metadata/metadata.module';
import { ShutdownModule } from '../shutdown/shutdown.module';
import { BotService } from './bot.service';
import { BotController } from './bot.controller';

@Module({
  imports: [MetadataModule, ShutdownModule],
  providers: [BotService],
  controllers: [BotController],
  exports: [BotService],
})
export class BotModule {}

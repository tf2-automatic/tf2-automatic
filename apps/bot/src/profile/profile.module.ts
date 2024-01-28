import { Module } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { ProfileController } from './profile.controller';
import { BotModule } from '../bot/bot.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [StorageModule, BotModule],
  providers: [ProfileService],
  controllers: [ProfileController],
})
export class ProfileModule {}

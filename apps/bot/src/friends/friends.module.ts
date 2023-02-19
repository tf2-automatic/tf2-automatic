import { Module } from '@nestjs/common';
import { FriendsService } from './friends.service';
import { FriendsController } from './friends.controller';
import { BotModule } from '../bot/bot.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [BotModule, EventsModule],
  providers: [FriendsService],
  controllers: [FriendsController],
  exports: [FriendsService],
})
export class FriendsModule {}

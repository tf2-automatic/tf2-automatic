import { Module } from '@nestjs/common';
import { FriendsService } from './friends.service';
import { FriendsController } from './friends.controller';
import { BotModule } from '../bot/bot.module';
import { EventsModule } from '../events/events.module';
import {
  makeGaugeProvider,
  PrometheusModule,
} from '@willsoto/nestjs-prometheus';

@Module({
  imports: [BotModule, EventsModule, PrometheusModule],
  providers: [
    FriendsService,
    makeGaugeProvider({
      name: 'bot_friend_relationships',
      help: 'The amount of relationships the bot has with other users',
      labelNames: ['relationship'],
    }),
  ],
  controllers: [FriendsController],
  exports: [FriendsService],
})
export class FriendsModule {}

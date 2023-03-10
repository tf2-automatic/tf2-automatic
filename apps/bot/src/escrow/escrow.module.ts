import { Module } from '@nestjs/common';
import { EscrowService } from './escrow.service';
import { EscrowController } from './escrow.controller';
import { BotModule } from '../bot/bot.module';
import { FriendsModule } from '../friends/friends.module';

@Module({
  imports: [BotModule, FriendsModule],
  providers: [EscrowService],
  controllers: [EscrowController],
})
export class EscrowModule {}

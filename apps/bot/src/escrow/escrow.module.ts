import { Module } from '@nestjs/common';
import { EscrowService } from './escrow.service';
import { EscrowController } from './escrow.controller';
import { BotModule } from '../bot/bot.module';
import { FriendsModule } from '../friends/friends.module';
import { TradesModule } from '../trades/trades.module';

@Module({
  imports: [BotModule, FriendsModule, TradesModule],
  providers: [EscrowService],
  controllers: [EscrowController],
})
export class EscrowModule {}

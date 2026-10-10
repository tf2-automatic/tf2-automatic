import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { BotModule } from '../bot/bot.module';
import { NotificationController } from './norification.controller';

@Module({
  imports: [BotModule],
  providers: [NotificationService],
  controllers: [NotificationController],
})
export class NotificationModule {}

import { Module } from '@nestjs/common';
import { HeartbeatsModule } from '../heartbeats/heartbeats.module';
import { PendingService } from './pending.service';
import { BotsModule } from '../bots/bots.module';
import { PendingController } from './pending.controller';

@Module({
  imports: [HeartbeatsModule, BotsModule],
  providers: [PendingService],
  controllers: [PendingController],
})
export class PendingModule {}

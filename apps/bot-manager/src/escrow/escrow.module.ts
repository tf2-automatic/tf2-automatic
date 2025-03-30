import { Module } from '@nestjs/common';
import { EscrowService } from './escrow.service';
import { EscrowController } from './escrow.controller';
import { RedisModule } from '@songkeys/nestjs-redis';
import { HeartbeatsModule } from '../heartbeats/heartbeats.module';
import { BullModule } from '@nestjs/bullmq';
import { defaultJobOptions } from '@tf2-automatic/queue';
import { EscrowProcessor } from './escrow.processor';

@Module({
  imports: [
    RedisModule,
    HeartbeatsModule,
    BullModule.registerQueue({
      name: 'escrow',
      defaultJobOptions,
    }),
  ],
  providers: [EscrowService, EscrowProcessor],
  controllers: [EscrowController],
})
export class EscrowModule {}

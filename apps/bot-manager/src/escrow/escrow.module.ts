import { Module } from '@nestjs/common';
import { EscrowService } from './escrow.service';
import { EscrowController } from './escrow.controller';
import { RedisModule } from '@songkeys/nestjs-redis';
import { HttpModule } from '@nestjs/axios';
import { HeartbeatsModule } from '../heartbeats/heartbeats.module';

@Module({
  imports: [RedisModule, HttpModule, HeartbeatsModule],
  providers: [EscrowService],
  controllers: [EscrowController],
})
export class EscrowModule {}

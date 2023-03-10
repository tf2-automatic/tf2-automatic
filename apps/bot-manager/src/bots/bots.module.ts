import { Module } from '@nestjs/common';
import { BotsService } from './bots.service';
import { BotsController } from './bots.controller';
import { HeartbeatsModule } from '../heartbeats/heartbeats.module';

@Module({
  imports: [HeartbeatsModule],
  providers: [BotsService],
  controllers: [BotsController],
})
export class BotsModule {}

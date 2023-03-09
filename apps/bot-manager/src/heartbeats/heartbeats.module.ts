import { RedisModule } from '@liaoliaots/nestjs-redis';
import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { HeartbeatsController } from './heartbeats.controller';
import { HeartbeatsService } from './heartbeats.service';

@Module({
  imports: [RedisModule, HttpModule],
  controllers: [HeartbeatsController],
  providers: [HeartbeatsService],
  exports: [HeartbeatsService],
})
export class HeartbeatsModule {}

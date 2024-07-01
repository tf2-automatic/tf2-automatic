import { Module } from '@nestjs/common';
import { PublisherService } from './publisher.service';
import { RedisModule } from '@songkeys/nestjs-redis';

@Module({
  imports: [RedisModule],
  providers: [PublisherService],
})
export class PublisherModule {}

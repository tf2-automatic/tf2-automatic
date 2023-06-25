import { Module } from '@nestjs/common';
import { PublisherService } from './publisher.service';
import { RedisModule } from '@liaoliaots/nestjs-redis';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [RedisModule, EventsModule],
  providers: [PublisherService],
})
export class PublisherModule {}

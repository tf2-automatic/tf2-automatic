import { Module } from '@nestjs/common';
import { RabbitMQWrapperModule } from '../rabbitmq-wrapper/rabbitmq-wrapper.module';
import { EventsService } from './events.service';

@Module({
  imports: [RabbitMQWrapperModule],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}

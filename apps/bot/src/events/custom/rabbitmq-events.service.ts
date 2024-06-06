import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import type { ConfirmChannel } from 'amqplib';
import { BaseEvent, BOT_EXCHANGE_NAME } from '@tf2-automatic/bot-data';
import { CustomEventsService } from './custom.interface';

@Injectable()
export class RabbitMQEventsService
  implements OnModuleDestroy, CustomEventsService
{
  constructor(private readonly amqpConnection: AmqpConnection) {}

  async onModuleDestroy(): Promise<void> {
    return (this.amqpConnection.channel as ConfirmChannel).waitForConfirms();
  }

  async publish(type: string, data: BaseEvent<unknown>): Promise<void> {
    await this.amqpConnection.publish(BOT_EXCHANGE_NAME, type, data);
  }
}

import {
  AmqpConnection,
  MessageHandlerOptions,
  requeueErrorHandler,
} from '@golevelup/nestjs-rabbitmq';
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import type { ConfirmChannel } from 'amqplib';
import { BaseEvent } from '@tf2-automatic/bot-data';
import { CustomEventsService, SubscriberSettings } from './custom.interface';

@Injectable()
export class RabbitMQEventsService
  implements OnModuleDestroy, CustomEventsService
{
  constructor(
    private readonly amqpConnection: AmqpConnection,
  ) {}

  async onModuleDestroy(): Promise<void> {
    return (this.amqpConnection.channel as ConfirmChannel).waitForConfirms();
  }

  async publish(exchange: string, type: string, data: BaseEvent<unknown>): Promise<void> {
    await this.amqpConnection.publish(exchange, type, data);
  }

  async subscribe<T extends BaseEvent<unknown>>(
    name: string,
    exchange: string,
    events: string[],
    handler: (message: T) => Promise<void>,
    settings?: SubscriberSettings,
  ): Promise<void> {
    const messageOptions: MessageHandlerOptions = {
      queue: name,
      exchange,
      routingKey: events,
      allowNonJsonMessages: false,
    };

    if (settings?.retry) {
      messageOptions.errorHandler = requeueErrorHandler;
    }

    // @ts-ignore - The type of the handler is not compatible with the library
    await this.amqpConnection.createSubscriber<T>(handler, messageOptions, '');
  }
}

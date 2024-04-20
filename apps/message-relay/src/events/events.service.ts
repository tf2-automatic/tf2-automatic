import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import type { ConfirmChannel } from 'amqplib';
import { BaseEvent, EventMetadata } from '@tf2-automatic/bot-data';
import { BOT_MANAGER_EXCHANGE_NAME } from '@tf2-automatic/bot-manager-data';

@Injectable()
export class EventsService implements OnModuleDestroy {
  constructor(private readonly amqpConnection: AmqpConnection) {}

  async onModuleDestroy(): Promise<void> {
    return (this.amqpConnection.channel as ConfirmChannel).waitForConfirms();
  }

  async publish(
    type: string,
    data: object,
    metadata: EventMetadata,
  ): Promise<void> {
    await this.amqpConnection.publish(BOT_MANAGER_EXCHANGE_NAME, type, {
      type,
      data,
      metadata,
    } as BaseEvent<unknown>);
  }
}

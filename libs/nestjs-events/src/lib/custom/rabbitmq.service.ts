import {
  AmqpConnection,
  MessageHandlerOptions,
  requeueErrorHandler,
} from '@golevelup/nestjs-rabbitmq';
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import type { ConfirmChannel, GetMessage } from 'amqplib';
import { BaseEvent } from '@tf2-automatic/bot-data';
import {
  CustomEventsService,
  Handler,
  SubscriberSettings,
} from './custom.class';

export type Identifier = Awaited<
  ReturnType<AmqpConnection['createSubscriber']>
>;

@Injectable()
export class RabbitMQEventsService
  extends CustomEventsService
  implements OnModuleDestroy
{
  constructor(private readonly amqpConnection: AmqpConnection) {
    super();
  }

  async onModuleDestroy(): Promise<void> {
    return (this.amqpConnection.channel as ConfirmChannel).waitForConfirms();
  }

  canAttempt(): boolean {
    return true;
  }

  async publish(
    exchange: string,
    type: string,
    data: BaseEvent<unknown>,
  ): Promise<void> {
    await this.amqpConnection.publish(exchange, type, data);
  }

  async subscribe<T extends BaseEvent<unknown>>(
    name: string,
    exchange: string,
    events: string[],
    handler: Handler<T>,
    settings?: SubscriberSettings,
  ): Promise<Identifier> {
    const messageOptions: MessageHandlerOptions = {
      queue: name,
      exchange,
      routingKey: events,
      allowNonJsonMessages: false,
    };

    messageOptions.errorHandler = (channel, message, error) => {
      if (error instanceof SyntaxError) {
        // Do not requeue messages with a syntax error (e.g. invalid JSON)
        return channel.nack(message, false, false);
      }

      if (settings?.retry) {
        return requeueErrorHandler(channel, message, error);
      }
    };

    // @ts-ignore - The type of the handler is not compatible with the library
    return this.amqpConnection.createSubscriber<T>(handler, messageOptions, '');
  }

  async unsubscribe(identifier: Identifier): Promise<void> {
    return this.amqpConnection.cancelConsumer(identifier.consumerTag);
  }

  override async attempt<T extends BaseEvent<unknown>>(
    name: string,
    _: string,
    __: string[],
    handler: Handler<T>,
    settings: SubscriberSettings,
  ): Promise<boolean> {
    const getMessage = async () => {
      const message = await this.amqpConnection.channel.get(name, {
        noAck: false,
      });

      if (message === false) {
        return false;
      }

      let parsed;
      try {
        parsed = JSON.parse(message.content.toString());
      } catch (err) {
        this.amqpConnection.channel.nack(message, false, false);
        return null;
      }

      return message;
    };

    let message: GetMessage | false | null = null;

    do {
      message = await getMessage();
    } while (message === null);

    if (message === false) {
      return false;
    }

    return await handler(JSON.parse(message.content.toString()))
      .then(() => {
        this.amqpConnection.channel.ack(message);
        return true;
      })
      .catch((err) => {
        this.amqpConnection.channel.nack(
          message,
          false,
          settings.retry ?? false,
        );

        throw err;
      });
  }
}

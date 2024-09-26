import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { BaseEvent } from '@tf2-automatic/bot-data';
import { EventsModuleOptions } from '../nestjs-events.module';
import { CustomEventsService, SubscriberSettings } from './custom.class';
import { Redis } from 'ioredis';
import { Redis as RedisConfig } from '@tf2-automatic/config';
import { LockDuration, Locker } from '@tf2-automatic/locking';

type Handler<T = BaseEvent<string>> = (message: T) => Promise<void>;

interface Subscriber {
  name: string;
  exchange: string;
  handler: Handler;
  settings?: SubscriberSettings;
}

export type Identifier = string;

@Injectable()
export class RedisEventsService
  extends CustomEventsService
  implements OnModuleDestroy
{
  private readonly subscribers: Record<string, Record<string, Subscriber[]>> =
    {};

  private readonly publisher: Redis;
  private readonly subscriber: Redis;
  private readonly locker: Locker;

  constructor(
    @Inject('EVENTS_OPTIONS')
    private readonly options: EventsModuleOptions<RedisConfig.Config>,
  ) {
    super();

    this.publisher = new Redis(options.config);
    this.subscriber = new Redis(options.config);
    this.locker = new Locker(this.publisher);

    this.subscriber.on('message', (channel, message) => {
      const exchanges = this.subscribers[channel];
      if (!exchanges) {
        return;
      }

      const event = JSON.parse(message) as BaseEvent<string>;

      const subscribers = exchanges[event.type];
      if (!subscribers) {
        return;
      }

      const resources = subscribers.map(
        (subscriber) => subscriber.name + '_' + event.metadata.id,
      );

      this.locker
        .using(resources, LockDuration.LONG, async () => {
          subscribers.forEach((subscriber) =>
            this.handleEvent(subscriber, event),
          );
        })
        .catch(() => {
          // Ignore error
        });
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.subscriber.quit();
    await this.publisher.quit();
  }

  canAttempt(): boolean {
    return false;
  }

  private handleEvent(subscriber: Subscriber, event: BaseEvent<string>) {
    subscriber.handler(event).catch(() => {
      if (subscriber.settings?.retry) {
        this.handleEvent(subscriber, event);
      }
    });
  }

  async publish(
    exchange: string,
    _: string,
    data: BaseEvent<unknown>,
  ): Promise<void> {
    const event = JSON.stringify(data);

    const multi = this.publisher.multi();

    if (this.options.config.persist) {
      multi.lpush(exchange, event);
    }

    multi.publish(exchange, event);

    await multi.exec();
  }

  async subscribe<T extends BaseEvent<string>>(
    name: string,
    exchange: string,
    events: string[],
    handler: Handler<T>,
    settings?: SubscriberSettings,
  ): Promise<Identifier> {
    const subscriber: Subscriber = {
      name,
      exchange,
      handler: handler as Handler,
      settings,
    };

    if (!this.subscribers[exchange]) {
      this.subscribers[exchange] = {};
    }

    events.forEach((event) => {
      this.subscribers[exchange][event] =
        this.subscribers[exchange][event] ?? [];
      this.subscribers[exchange][event].push(subscriber);
    });

    await this.subscriber.subscribe(exchange);

    return exchange;
  }

  async unsubscribe(identifier: Identifier): Promise<void> {
    await this.subscriber.unsubscribe(identifier);
  }
}

import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { BaseEvent } from '@tf2-automatic/bot-data';
import SteamID from 'steamid';
import {
  CustomEventsService,
  Handler,
  SubscriberSettings,
} from './custom/custom.class';
import { EventsModuleOptions } from './nestjs-events.module';
import { v4 as uuidv4 } from 'uuid';
import { EventsConfigType } from '@tf2-automatic/config';
import { Subscriber } from './subscriber.class';

@Injectable()
export class NestEventsService implements OnModuleDestroy {
  private readonly subscribers: Map<string, Subscriber<any>> = new Map();

  constructor(
    @Inject('EVENTS_ENGINE') private readonly engine: CustomEventsService,
    @Inject('EVENTS_OPTIONS') private readonly options: EventsModuleOptions,
  ) {}

  getType(): EventsConfigType {
    return this.options.config.type;
  }

  async publish(
    event: string,
    data: object = {},
    steamid?: SteamID,
  ): Promise<void> {
    await this.publishEvent({
      type: event,
      data,
      metadata: {
        id: uuidv4(),
        steamid64: steamid?.getSteamID64() ?? null,
        time: Math.floor(new Date().getTime() / 1000),
      },
    } satisfies BaseEvent<string>);
  }

  async publishEvent(event: BaseEvent<string>): Promise<void> {
    await this.engine.publish(
      this.options.publishingExchange,
      event.type,
      event,
    );
  }

  async subscribe<T extends BaseEvent<string>>(
    name: string,
    exchange: string,
    events: string[],
    handler: Handler<T>,
    settings?: SubscriberSettings,
  ): Promise<void> {
    const subscriber = this.createSubscriber(
      name,
      exchange,
      events,
      handler,
      settings,
    );

    await subscriber.resume();
  }

  createSubscriber<T extends BaseEvent<string>>(
    name: string,
    exchange: string,
    events: string[],
    handler: Handler<T>,
    settings?: SubscriberSettings,
  ): Subscriber<T> {
    if (this.subscribers.has(name)) {
      throw new Error('Subscriber already exists');
    } else if (!this.options.subscriberExchanges.includes(exchange)) {
      throw new Error('Invalid exchange');
    }

    const subscriber = new Subscriber<T>(this.engine, {
      name,
      exchange,
      events,
      handler,
      settings,
    });

    this.subscribers.set(name, subscriber);

    return subscriber;
  }

  async onModuleDestroy() {
    const subscribers = Array.from(this.subscribers.values());

    const promises = subscribers.map((subscriber) => {
      return subscriber.shutdown();
    });

    await Promise.all(promises);
  }
}

import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { BaseEvent, EventMetadata } from '@tf2-automatic/bot-data';
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
import { ClsService } from 'nestjs-cls';

@Injectable()
export class NestEventsService implements OnModuleDestroy {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly subscribers: Map<string, Subscriber<any>> = new Map();
  private readonly logger = new Logger(NestEventsService.name);

  constructor(
    @Inject('EVENTS_ENGINE') private readonly engine: CustomEventsService,
    @Inject('EVENTS_OPTIONS') private readonly options: EventsModuleOptions,
    private readonly cls: ClsService,
  ) {}

  getType(): EventsConfigType {
    return this.options.config.type;
  }

  getExchange(): string {
    return this.options.publishingExchange;
  }

  async publish(
    event: string,
    data: object = {},
    steamid?: SteamID,
  ): Promise<void> {
    // We should never publish null data
    if (data === null) {
      this.logger.warn(`Event "${event}" has null data, skipping publish.`);
      return;
    }

    const metadata: EventMetadata = {
      id: uuidv4(),
      steamid64: steamid?.getSteamID64() ?? null,
      time: Math.floor(new Date().getTime() / 1000),
    };

    if (this.cls.isActive() && this.cls.has('userAgent')) {
      metadata.userAgent = this.cls.get('userAgent');
    }

    await this.publishEvent({
      type: event,
      data,
      metadata,
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

    const subscriber = new Subscriber<T>(
      this.engine,
      name,
      exchange,
      events,
      handler,
      {
        broadcast: settings?.broadcast ?? false,
        retry: settings?.retry ?? false,
      },
    );

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

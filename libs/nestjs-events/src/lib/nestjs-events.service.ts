import { Inject, Injectable, Logger } from '@nestjs/common';
import { BaseEvent } from '@tf2-automatic/bot-data';
import SteamID from 'steamid';
import {
  CustomEventsService,
  SubscriberSettings,
} from './custom/custom.interface';
import { EventsModuleOptions } from './nestjs-events.module';
import { v4 as uuidv4 } from 'uuid';
import { EventsConfigType } from '@tf2-automatic/config';

@Injectable()
export class NestEventsService {
  private readonly logger = new Logger(NestEventsService.name);

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

  subscribe<T extends BaseEvent<string>>(
    name: string,
    exchange: string,
    events: string[],
    handler: (message: T) => Promise<void>,
    settings?: SubscriberSettings,
  ): Promise<void> {
    if (!this.options.publishingExchange.includes(exchange)) {
      throw new Error('Invalid exchange');
    }

    this.logger.log(
      `Subscribing to "${exchange}" with events [${events
        .map((event) => `"${event}"`)
        .join(',')}]`,
    );

    return this.engine.subscribe(name, exchange, events, handler, settings);
  }
}

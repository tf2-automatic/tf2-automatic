import { Logger } from '@nestjs/common';
import {
  CustomEventsService,
  Handler,
  SubscriberSettings,
} from './custom/custom.class';
import { BaseEvent } from '@tf2-automatic/bot-data';
import CircuitBreaker from 'opossum';
import promiseRetry from 'promise-retry';
import { v4 as uuid } from 'uuid';

export class Subscriber<T extends BaseEvent<string>> {
  private readonly logger: Logger;

  private identifier: unknown = null;

  private name: string;
  private exchange: string;
  private events: string[];
  private handler: Handler<T>;
  private settings: SubscriberSettings;

  private subscribePromise: Promise<unknown> | null = null;
  private unsubscribePromise: Promise<void> | null = null;

  private readonly breaker = new CircuitBreaker(async (...args: [T]) => {
    return this.handler(...args).catch((err) => {
      this.logger.error('Error in handler');
      console.error(err);
      throw err;
    });
  });
  private interval: NodeJS.Timeout | null = null;

  constructor(
    private readonly engine: CustomEventsService,
    name: string,
    exchange: string,
    events: string[],
    handler: Handler<T>,
    settings: SubscriberSettings,
  ) {
    this.name = name;

    if (settings.broadcast) {
      // Add random string to name
      this.name += `-${uuid().replace(/-/g, '')}`;
    }

    this.exchange = exchange;
    this.events = events;
    this.handler = handler;
    this.settings = settings;

    this.logger = new Logger(Subscriber.name + '<' + name + '>');

    this.breaker.on('open', () => {
      this.logger.warn('Circuit breaker opened');

      promiseRetry(
        async (retry) => {
          if (this.breaker.opened) {
            return this.pause().catch(retry);
          }
        },
        { forever: true },
      );
    });

    this.breaker.on('halfOpen', () => {
      this.logger.warn('Circuit breaker half-open');

      promiseRetry(
        async (retry) => {
          if (!this.breaker.halfOpen) {
            return;
          }

          if (this.engine.canAttempt()) {
            // Attempt to handle an event
            const attempted = await this.attempt().catch(retry);
            if (attempted) {
              // Exit early if an event was handled
              return;
            }
          }

          // Engine does not support single attempts to handle events, or there
          // were no events to handle.

          // Resume the subscriber to listen for events.
          return this.resume().catch(retry);
        },
        { forever: true },
      );
    });

    this.breaker.on('close', () => {
      this.logger.warn('Circuit breaker closed');

      promiseRetry(
        async (retry) => {
          if (this.breaker.closed) {
            return this.resume().catch(retry);
          }
        },
        { forever: true },
      );
    });
  }

  async shutdown(): Promise<void> {
    if (this.interval !== null) {
      clearInterval(this.interval);
      this.interval = null;
    }

    this.breaker.shutdown();
    await this.pause();
  }

  async resume(): Promise<void> {
    if (this.subscribePromise) {
      await this.subscribePromise;
      return;
    } else if (this.unsubscribePromise) {
      await this.unsubscribePromise;
    }

    if (this.identifier) {
      return;
    }

    this.logger.debug(
      `Subscribing to "${this.exchange}" with events [${this.events
        .map((event) => `"${event}"`)
        .join(',')}]`,
    );

    this.subscribePromise = this.engine
      .subscribe<T>(
        this.name,
        this.exchange,
        this.events,
        this.breaker.fire.bind(this.breaker),
        this.settings,
      )
      .then((identifier) => {
        this.identifier = identifier;
      })
      .finally(() => {
        this.subscribePromise = null;
      });

    await this.subscribePromise;
  }

  async pause(): Promise<void> {
    if (this.unsubscribePromise) {
      return this.unsubscribePromise;
    } else if (this.subscribePromise) {
      await this.subscribePromise;
    }

    if (!this.identifier) {
      return;
    }

    this.logger.debug(`Unsubscribing from "${this.exchange}"`);

    this.unsubscribePromise = this.engine
      .unsubscribe(this.identifier)
      .finally(() => {
        this.unsubscribePromise = null;
        this.identifier = null;
      });

    await this.unsubscribePromise;
  }

  async attempt(): Promise<boolean> {
    return this.engine.attempt<T>(
      this.name,
      this.exchange,
      this.events,
      this.breaker.fire.bind(this.breaker),
      this.settings,
    );
  }
}

import { Logger } from '@nestjs/common';
import {
  CustomEventsService,
  Handler,
  SubscriberSettings,
} from './custom/custom.class';
import { BaseEvent } from '@tf2-automatic/bot-data';
import CircuitBreaker from 'opossum';
import promiseRetry from 'promise-retry';

export interface SubscriberOptions<T extends BaseEvent<unknown>> {
  name: string;
  exchange: string;
  events: string[];
  handler: Handler<T>;
  settings?: SubscriberSettings;
}

export class Subscriber<T extends BaseEvent<string>> {
  private readonly logger = new Logger(
    Subscriber.name + '<' + this.options.name + '>',
  );

  private identifier: any = null;
  private subscribePromise: Promise<any> | null = null;
  private unsubscribePromise: Promise<void> | null = null;

  private readonly breaker = new CircuitBreaker((...args: [T]) => {
    return this.options.handler(...args).catch((err) => {
      this.logger.error('Error in handler');
      console.error(err);
      throw err;
    });
  });
  private interval: NodeJS.Timeout | null = null;

  private previouslyClosed = true;

  constructor(
    private readonly engine: CustomEventsService,
    private readonly options: SubscriberOptions<T>,
  ) {
    this.breaker.on('open', () => {
      if (this.previouslyClosed) {
        this.previouslyClosed = false;
        this.logger.warn('Circuit breaker opened');
      }

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
      if (!this.previouslyClosed) {
        this.previouslyClosed = true;
        this.logger.warn('Circuit breaker closed');
      }

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
      return this.subscribePromise;
    } else if (this.unsubscribePromise) {
      await this.unsubscribePromise;
    }

    if (this.identifier) {
      return;
    }

    this.subscribePromise = new Promise(async (resolve) => {
      this.logger.debug(
        `Subscribing to "${
          this.options.exchange
        }" with events [${this.options.events
          .map((event) => `"${event}"`)
          .join(',')}]`,
      );

      this.identifier = await this.engine.subscribe<T>(
        this.options.name,
        this.options.exchange,
        this.options.events,
        this.breaker.fire.bind(this.breaker),
        this.options.settings,
      );

      resolve(this.identifier);
    }).finally(() => {
      this.subscribePromise = null;
    });
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

    await new Promise(async (resolve) => {
      this.logger.debug(`Unsubscribing from "${this.options.exchange}"`);

      await this.engine.unsubscribe(this.identifier);

      this.identifier = null;
    }).finally(() => {
      this.unsubscribePromise = null;
    });
  }

  async attempt(): Promise<boolean> {
    return this.engine.attempt<T>(
      this.options.name,
      this.options.exchange,
      this.options.events,
      this.breaker.fire.bind(this.breaker),
      this.options.settings,
    );
  }
}

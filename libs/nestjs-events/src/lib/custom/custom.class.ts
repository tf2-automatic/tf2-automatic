import { BaseEvent } from '@tf2-automatic/bot-data';

export type Handler<MessageType extends BaseEvent<unknown>> = (
  message: MessageType,
) => Promise<void>;

export interface SubscriberSettings {
  /**
   * If the subscriber should requeue messages on error
   */
  retry?: boolean;

  /**
   * If all subscribers listening to messages from the exchange should receive the messages
   */
  broadcast?: boolean;
}

export abstract class CustomEventsService {
  abstract canAttempt(): boolean;

  abstract publish(
    exchange: string,
    event: string,
    data: BaseEvent<string>,
  ): Promise<void>;

  abstract subscribe<T extends BaseEvent<string>>(
    name: string,
    exchange: string,
    events: string[],
    handler: Handler<T>,
    settings?: SubscriberSettings,
  ): Promise<unknown>;

  abstract unsubscribe(identifier: unknown): Promise<void>;

  attempt<T extends BaseEvent<string>>(
    /* eslint-disable @typescript-eslint/no-unused-vars */
    name: string,
    exchange: string,
    events: string[],
    handler: Handler<T>,
    settings?: SubscriberSettings,
    /* eslint-enable @typescript-eslint/no-unused-vars */
  ): Promise<boolean> {
    throw new Error('Method not implemented');
  }
}

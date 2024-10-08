import { BaseEvent } from '@tf2-automatic/bot-data';

export type Handler<MessageType extends BaseEvent<unknown>> = (
  message: MessageType,
) => Promise<void>;

export interface SubscriberSettings {
  retry?: boolean;
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
  ): Promise<any>;

  abstract unsubscribe(identifier: any): Promise<void>;

  attempt<T extends BaseEvent<string>>(
    name: string,
    exchange: string,
    events: string[],
    handler: Handler<T>,
    settings?: SubscriberSettings,
  ): Promise<boolean> {
    throw new Error('Method not implemented');
  }
}
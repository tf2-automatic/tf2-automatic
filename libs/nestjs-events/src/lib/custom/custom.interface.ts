import { BaseEvent } from '@tf2-automatic/bot-data';

export interface SubscriberSettings {
  retry?: boolean;
}

export interface CustomEventsService {
  publish(
    exchange: string,
    event: string,
    data: BaseEvent<string>,
  ): Promise<void>;

  subscribe<T extends BaseEvent<string>>(
    name: string,
    exchange: string,
    events: string[],
    handler: (message: T) => Promise<void>,
    settings?: SubscriberSettings,
  ): Promise<void>;
}

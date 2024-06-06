import { BaseEvent } from '@tf2-automatic/bot-data';

export interface CustomEventsService {
  publish(event: string, data: BaseEvent<unknown>): Promise<void>;
}

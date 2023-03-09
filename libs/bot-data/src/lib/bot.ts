import { BaseEvent } from './events';

export const BOT_BASE_URL = '/bot';
export const BOT_PATH = `/`;

export const BOT_READY_EVENT = 'bot.ready';

export interface BotReadyEvent extends BaseEvent {
  type: typeof BOT_READY_EVENT;
}

export interface Bot {
  steamid64: string;
}

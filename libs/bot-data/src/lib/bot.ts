import { BaseEvent } from './events';

export const BOT_BASE_URL = '/bot';
export const BOT_PATH = `/`;
export const BOT_WEBSESSION_PATH = '/websession';

export const BOT_FULL_PATH = `${BOT_BASE_URL}`;
export const BOT_WEBSESSION_FULL_PATH = `${BOT_BASE_URL}${BOT_WEBSESSION_PATH}`;

export type BotReadyEventType = 'bot.ready';

export const BOT_READY_EVENT: BotReadyEventType = 'bot.ready';

export type BotReadyEvent = BaseEvent<BotReadyEventType>;

export interface Bot {
  steamid64: string;
  apiKey: string;
  // The name the bot logs in with
  accountName: string;
  // The public profile name, unset until the bot has logged on
  personaName?: string;
}

export interface BotWebSession {
  cookies: string[];
}

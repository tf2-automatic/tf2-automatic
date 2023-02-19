import { BaseEvent } from './events';

export const BOT_READY_EVENT = 'bot.ready';

export interface BotReadyEvent extends BaseEvent {
  type: typeof BOT_READY_EVENT;
}
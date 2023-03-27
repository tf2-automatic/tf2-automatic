import { CreateTrade } from '@tf2-automatic/bot-data';
import {
  QueueTradeType,
  RetryTradeOptions,
} from '@tf2-automatic/bot-manager-data';

export type TradeQueue = CreateTradeJob;

export type CreateTradeJob = BaseTradeQueue<
  'CREATE',
  CreateTrade,
  {
    checkCreatedAfter?: number;
  }
>;

interface BaseTradeQueue<Event extends QueueTradeType, Raw, Extra> {
  type: Event;
  raw: Raw;
  extra: Extra;
  bot: string;
  retry?: RetryTradeOptions;
}

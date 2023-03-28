import { CreateTrade } from '@tf2-automatic/bot-data';
import {
  QueueTradeType,
  RetryTradeOptions,
} from '@tf2-automatic/bot-manager-data';

export type TradeQueue = CreateTradeJob | DeleteTradeJob;

export type CreateTradeJob = BaseTradeQueue<
  'CREATE',
  CreateTrade,
  {
    checkCreatedAfter?: number;
  }
>;

export type DeleteTradeJob = BaseTradeQueue<'DELETE', string>;

interface BaseTradeQueue<
  Event extends QueueTradeType,
  Raw,
  Extra = Record<string, unknown>
> {
  type: Event;
  raw: Raw;
  extra: Extra;
  bot: string;
  retry?: RetryTradeOptions;
}

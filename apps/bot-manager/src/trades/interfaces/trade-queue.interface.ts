import { CounterTrade, CreateTrade } from '@tf2-automatic/bot-data';
import {
  QueueTradeType,
  RetryTradeOptions,
} from '@tf2-automatic/bot-manager-data';

export type TradeQueue =
  | CreateTradeJob
  | CounterTradeJob
  | DeleteTradeJob
  | AcceptTradeJob
  | ConfirmTradeJob;

export type CreateTradeJob = BaseTradeQueue<
  'CREATE',
  CreateTrade,
  {
    checkCreatedAfter?: number;
  }
>;

export type CounterTradeJob = BaseTradeQueue<'COUNTER', CounterTrade>;

export type DeleteTradeJob = BaseTradeQueue<'DELETE', string>;

export type AcceptTradeJob = BaseTradeQueue<'ACCEPT', string>;

export type ConfirmTradeJob = BaseTradeQueue<'CONFIRM', string>;

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

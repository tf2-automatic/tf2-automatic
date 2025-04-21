import { CreateTrade } from '@tf2-automatic/bot-data';
import {
  ManagerCounterTrade,
  QueueTradeType,
} from '@tf2-automatic/bot-manager-data';
import { JobDataWithBot } from '@tf2-automatic/queue';

export type TradeQueue =
  | CreateTradeJob
  | CounterTradeJob
  | DeleteTradeJob
  | AcceptTradeJob
  | ConfirmTradeJob
  | RefreshTradeJob;

export type CreateTradeJob = BaseTradeQueue<
  'CREATE',
  CreateTrade,
  {
    checkCreatedAfter?: number;
  }
>;

export type CounterTradeJob = BaseTradeQueue<'COUNTER', ManagerCounterTrade>;

export type DeleteTradeJob = BaseTradeQueue<
  'DELETE',
  string,
  { alreadyDeleted?: boolean }
>;

export type AcceptTradeJob = BaseTradeQueue<
  'ACCEPT',
  string,
  { alreadyAccepted?: boolean }
>;

export type ConfirmTradeJob = BaseTradeQueue<
  'CONFIRM',
  string,
  { alreadyConfirmed?: boolean }
>;

export type RefreshTradeJob = BaseTradeQueue<'REFRESH', string>;

type BaseTradeQueue<
  EventType extends QueueTradeType,
  OptionsType,
  StateType = unknown,
> = JobDataWithBot<OptionsType, StateType, EventType>;

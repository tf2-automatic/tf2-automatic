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
export type CounterTradeJob = BaseTradeQueue<
  'COUNTER',
  ManagerCounterTrade,
  {
    checkCreatedAfter?: number;
  }
>;
export type DeleteTradeJob = BaseTradeQueue<'DELETE', string>;
export type AcceptTradeJob = BaseTradeQueue<'ACCEPT', string>;
export type ConfirmTradeJob = BaseTradeQueue<'CONFIRM', string>;
export type RefreshTradeJob = BaseTradeQueue<'REFRESH', string>;

type BaseTradeQueue<
  EventType extends QueueTradeType,
  OptionsType,
  StateType = unknown,
> = JobDataWithBot<OptionsType, StateType, EventType>;

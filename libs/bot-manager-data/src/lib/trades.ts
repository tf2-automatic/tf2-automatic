import {
  BaseEvent,
  CounterTrade,
  CreateTrade,
  TradeOffer,
  TradeOfferExchangeDetails,
} from '@tf2-automatic/bot-data';

export const TRADES_BASE_URL = '/trades';
export const TRADE_JOBS_PATH = `/`;
export const TRADE_JOB_PATH = `/:id`;

export interface ManagerCounterTrade extends CounterTrade {
  id: string;
}

export interface RetryTradeOptions {
  strategy?: 'exponential' | 'linear' | 'fixed';
  maxTime?: number;
  delay?: number;
  maxDelay?: number;
}

export const QueueTradeTypes = [
  'CREATE',
  'COUNTER',
  'DELETE',
  'ACCEPT',
  'CONFIRM',
] as const;
export type QueueTradeType = (typeof QueueTradeTypes)[number];

export type QueueTradeCreate = QueueTrade<'CREATE', CreateTrade>;
export type QueueTradeCounter = QueueTrade<'COUNTER', ManagerCounterTrade>;
export type QueueTradeDelete = QueueTrade<'DELETE', string>;
export type QueueTradeAccept = QueueTrade<'ACCEPT', string>;
export type QueueTradeConfirm = QueueTrade<'CONFIRM', string>;

export interface QueueTrade<
  Type extends QueueTradeType = QueueTradeType,
  Data = unknown
> {
  type: Type;
  data: Data;
  bot: string;
  priority?: number;
  retry?: RetryTradeOptions;
}

export interface QueueTradeResponse {
  id: string;
}

export type ExchangeDetailsEventType = 'trades.exchange-details';

export const TRADES_EVENT_PREFIX = 'trades';
export const EXCHANGE_DETAILS_EVENT: ExchangeDetailsEventType = `${TRADES_EVENT_PREFIX}.exchange-details`;

export type ExchangeDetailsEvent = BaseEvent<
  ExchangeDetailsEvent,
  {
    offer: TradeOffer;
    details: TradeOfferExchangeDetails;
  }
>;

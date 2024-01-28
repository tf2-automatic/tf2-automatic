import {
  BaseEvent,
  CounterTrade,
  CreateTrade,
  HttpError,
  TradeOffer,
  TradeOfferExchangeDetails,
} from '@tf2-automatic/bot-data';
import { Job, RetryOptions } from './misc';

export const TRADES_BASE_URL = '/trades';
export const TRADE_JOBS_PATH = `/`;
export const TRADE_JOB_PATH = `/:id`;
// Full paths for use when making HTTP requests
export const TRADES_FULL_PATH = `${TRADES_BASE_URL}`;
export const TRADE_FULL_PATH = `${TRADES_BASE_URL}${TRADE_JOB_PATH}`;

export interface ManagerCounterTrade extends CounterTrade {
  id: string;
}

export const QueueTradeTypes = [
  'CREATE',
  'COUNTER',
  'DELETE',
  'ACCEPT',
  'CONFIRM',
] as const;
export type QueueTradeType = (typeof QueueTradeTypes)[number];

export type QueueTradeJob =
  | QueueTradeCreate
  | QueueTradeCounter
  | QueueTradeDelete
  | QueueTradeAccept
  | QueueTradeConfirm;

export type QueueTradeJobData = (QueueTradeCreate &
  QueueTradeCounter &
  QueueTradeDelete &
  QueueTradeAccept &
  QueueTradeConfirm)['data'];

export type QueueTradeCreate = QueueTrade<'CREATE', CreateTrade>;
export type QueueTradeCounter = QueueTrade<'COUNTER', ManagerCounterTrade>;
export type QueueTradeDelete = QueueTrade<'DELETE', string>;
export type QueueTradeAccept = QueueTrade<'ACCEPT', string>;
export type QueueTradeConfirm = QueueTrade<'CONFIRM', string>;

export interface QueueTrade<
  Type extends QueueTradeType = QueueTradeType,
  Data = unknown,
> {
  type: Type;
  data: Data;
  bot: string;
  priority?: number;
  retry?: RetryOptions;
}

export interface QueueTradeResponse {
  id: string;
}

export const TRADES_EVENT_PREFIX = 'trades';

export type ExchangeDetailsEventType = 'trades.exchange_details';
export const EXCHANGE_DETAILS_EVENT: ExchangeDetailsEventType = `${TRADES_EVENT_PREFIX}.exchange_details`;

export type ExchangeDetailsEvent = BaseEvent<
  ExchangeDetailsEventType,
  {
    offer: TradeOffer;
    details: TradeOfferExchangeDetails;
  }
>;

interface TradeEventData {
  job: Job;
  response: HttpError | null;
  error: string;
}

export type TradeErrorEventType = 'trades.error';
export const TRADE_ERROR_EVENT: TradeErrorEventType = `${TRADES_EVENT_PREFIX}.error`;

export type TradeErrorEvent = BaseEvent<TradeErrorEventType, TradeEventData>;

export type TradeFailedEventType = 'trades.failed';
export const TRADE_FAILED_EVENT: TradeFailedEventType = `${TRADES_EVENT_PREFIX}.failed`;

export type TradeFailedEvent = BaseEvent<TradeFailedEventType, TradeEventData>;

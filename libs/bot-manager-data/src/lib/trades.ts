import {
  BaseEvent,
  CreateTrade,
  TradeOffer,
  TradeOfferExchangeDetails,
} from '@tf2-automatic/bot-data';

export const TRADES_BASE_URL = '/trades';
export const TRADE_JOBS_PATH = `/`;
export const TRADE_JOB_PATH = `/:id`;

export interface RetryTradeOptions {
  strategy?: 'exponential' | 'linear' | 'fixed';
  maxTime?: number;
  delay?: number;
  maxDelay?: number;
}

export const QueueTradeTypes = ['CREATE'] as const;
export type QueueTradeType = (typeof QueueTradeTypes)[number];

export interface QueueTrade {
  type: QueueTradeType;
  // FIXME: add types
  data: unknown;
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

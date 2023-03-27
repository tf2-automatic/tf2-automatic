import {
  BaseEvent,
  CreateTrade,
  TradeOffer,
  TradeOfferExchangeDetails,
} from '@tf2-automatic/bot-data';

export const TRADES_BASE_URL = '/trades';
export const TRADES_PATH = `/`;
export const TRADE_PATH = `/:id`;

export interface QueueTradeOptions {
  priority?: number;
  retryFor?: number;
  retryDelay?: number;
  maxRetryDelay?: number;
}

export interface QueueTrade {
  data: {
    trade: CreateTrade;
    checkCreatedAfter?: number;
  };
  bot: string;
  options: QueueTradeOptions;
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

import {
  BaseEvent,
  CreateTrade,
  TradeOffer,
  TradeOfferExchangeDetails,
} from '@tf2-automatic/bot-data';

export const TRADES_BASE_URL = '/trades';
export const TRADES_PATH = `/`;
export const TRADE_PATH = `/:id`;

export interface QueueTrade extends CreateTrade {
  bot: string;
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

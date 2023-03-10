import { BaseEvent, TradeOfferExchangeDetails } from '@tf2-automatic/bot-data';

export type ExchangeDetailsEventType = 'trades.exchange-details';

export const TRADES_EVENT_PREFIX = 'trades';
export const EXCHANGE_DETAILS_EVENT: ExchangeDetailsEventType = `${TRADES_EVENT_PREFIX}.exchange-details`;

export type ExchangeDetailsEvent = BaseEvent<
  ExchangeDetailsEvent,
  {
    offerId: string;
    details: TradeOfferExchangeDetails;
  }
>;

import type {
  ETradeOfferState,
  ETradeOfferConfirmationMethod,
} from 'steam-user';
import type SteamTradeOfferManager from 'steam-tradeoffer-manager';
import { Item } from './inventories';
import { BaseEvent } from './events';

export enum OfferFilter {
  ActiveOnly = 1,
  HistoricalOnly = 2,
  All = 3,
}

export interface GetTrades {
  filter: OfferFilter;
}

export interface ExchangeDetailsItem extends Item {
  new_assetid?: string;
  new_contextid?: string;
  rollback_new_assetid?: string;
  rollback_new_contextid?: string;
}

export interface TradeOfferExchangeDetails {
  status: SteamTradeOfferManager.ETradeStatus;
  tradeInitTime: number;
  receivedItems: ExchangeDetailsItem[];
  sentItems: ExchangeDetailsItem[];
}

export interface TradeOffer {
  partner: string;
  id: string;
  message: string;
  state: ETradeOfferState;
  itemsToGive: Item[];
  itemsToReceive: Item[];
  isGlitched: boolean;
  isOurOffer: boolean;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  tradeID: string | null;
  fromRealTimeTrade: boolean;
  confirmationMethod: ETradeOfferConfirmationMethod;
  escrowEndsAt: number | null;
}

interface BaseOfferEvent {
  offer: TradeOffer;
}

export interface GetTradesResponse {
  sent: TradeOffer[];
  received: TradeOffer[];
}

export type GetTradeResponse = TradeOffer;

export interface Asset {
  assetid: string;
  appid: number;
  contextid: string;
  amount?: number;
}

interface BaseTrade {
  message?: string;
  itemsToGive: Asset[];
  itemsToReceive: Asset[];
}

export interface CreateTrade extends BaseTrade {
  partner: string;
  token?: string;
}

export type CounterTrade = BaseTrade;

export type CreateTradeResponse = TradeOffer;
export type AcceptTradeResponse = TradeOffer;
export type DeleteTradeResponse = TradeOffer;

export type AcceptConfirmationResponse = {
  success: boolean;
};

export const TRADES_BASE_URL = '/trades';
export const TRADES_PATH = '/';
export const TRADE_PATH = '/:id';
export const TRADE_ACCEPT_PATH = `${TRADE_PATH}/accept`;
export const TRADE_EXCHANGE_DETAILS_PATH = `${TRADE_PATH}/exchange`;
export const TRADE_RECEIVED_ITEMS_PATH = `${TRADE_PATH}/received`;
export const TRADE_CONFIRMATION_PATH = `${TRADE_PATH}/confirm`;
export const TRADE_COUNTER_PATH = `${TRADE_PATH}/counter`;
// Full paths for use when making HTTP requests
export const TRADES_FULL_PATH = `${TRADES_BASE_URL}`;
export const TRADE_FULL_PATH = `${TRADES_BASE_URL}${TRADE_PATH}`;
export const TRADE_COUNTER_FULL_PATH = `${TRADES_BASE_URL}${TRADE_COUNTER_PATH}`;
export const TRADE_ACCEPT_FULL_PATH = `${TRADES_BASE_URL}${TRADE_ACCEPT_PATH}`;
export const TRADE_CONFIRM_FULL_PATH = `${TRADES_BASE_URL}${TRADE_CONFIRMATION_PATH}`;
export const TRADE_EXCHANGE_DETAILS_FULL_PATH = `${TRADES_BASE_URL}${TRADE_EXCHANGE_DETAILS_PATH}`;
export const TRADE_RECEIVED_ITEMS_FULL_PATH = `${TRADES_BASE_URL}${TRADE_RECEIVED_ITEMS_PATH}`;

export type TradeSentEventType = 'trades.sent';
export type TradeReceivedEventType = 'trades.received';
export type TradeChangedEventType = 'trades.changed';
export type TradeConfirmationNeededEventType = 'trades.confirmation_needed';

export const TRADE_EVENT_PREFIX = 'trades';
export const TRADE_SENT_EVENT: TradeSentEventType = `${TRADE_EVENT_PREFIX}.sent`;
export const TRADE_RECEIVED_EVENT: TradeReceivedEventType = `${TRADE_EVENT_PREFIX}.received`;
export const TRADE_CHANGED_EVENT: TradeChangedEventType = `${TRADE_EVENT_PREFIX}.changed`;
export const TRADE_CONFIRMATION_NEEDED_EVENT: TradeConfirmationNeededEventType = `${TRADE_EVENT_PREFIX}.confirmation_needed`;

export type TradeSentEvent = BaseEvent<TradeSentEventType, BaseOfferEvent>;

export type TradeReceivedEvent = BaseEvent<
  TradeReceivedEventType,
  BaseOfferEvent
>;

export type TradeChangedEvent = BaseEvent<
  TradeChangedEventType,
  BaseOfferEvent & { oldState: ETradeOfferState | null }
>;

export type TradeConfirmationNeededEvent = BaseEvent<
  TradeConfirmationNeededEventType,
  BaseOfferEvent
>;

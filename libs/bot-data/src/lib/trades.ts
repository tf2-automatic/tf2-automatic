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
  useCache?: boolean;
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

// TODO: Remove default type on next major version
export interface TradeOffer<T extends Item | Asset = Item> {
  partner: string;
  id: string;
  message: string;
  state: ETradeOfferState;
  itemsToGive: T[];
  itemsToReceive: T[];
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

export type TradeOfferWithItems = TradeOffer<Item>;
export type TradeOfferWithAssets = TradeOffer<Asset>;

interface BaseOfferEvent<T extends Item | Asset> {
  offer: TradeOffer<T>;
}

export interface GetTradesResponse<Cached = false> {
  sent: (Cached extends true
    ? TradeOfferWithItems | TradeOfferWithAssets
    : TradeOfferWithItems)[];
  received: TradeOfferWithItems[];
}

export type GetTradeResponse = TradeOfferWithItems;
export type RefreshTradeResponse = TradeOfferWithItems;

export interface Asset {
  assetid: string;
  appid: number;
  contextid: string;
  amount?: number;
}

export interface AssetWithAmount extends Asset {
  amount: number;
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

export type CreateTradeResponse = TradeOfferWithAssets;
export type AcceptTradeResponse = TradeOfferWithItems;
export type DeleteTradeResponse = TradeOfferWithItems;

export type AcceptConfirmationResponse = {
  success: boolean;
};

export interface CheckDeletedResponse {
  deleted: boolean;
}

export interface CheckAcceptedResponse {
  accepted: boolean;
}

export interface CheckConfirmationResponse {
  confirmed: boolean;
}

export const TRADES_BASE_URL = '/trades';
export const TRADES_PATH = '/';
export const TRADE_PATH = '/:id';
export const TRADE_DELETED_PATH = '/:id/deleted';
export const TRADE_ACCEPT_PATH = `${TRADE_PATH}/accept`;
export const TRADE_ACCEPTED_PATH = `${TRADE_PATH}/accepted`;
export const TRADE_EXCHANGE_DETAILS_PATH = `${TRADE_PATH}/exchange`;
export const TRADE_RECEIVED_ITEMS_PATH = `${TRADE_PATH}/received`;
export const TRADE_CONFIRMATION_PATH = `${TRADE_PATH}/confirm`;
export const TRADE_CONFIRMED_PATH = `${TRADE_PATH}/confirmed`;
export const TRADE_COUNTER_PATH = `${TRADE_PATH}/counter`;
export const TRADE_REFRESH_PATH = `${TRADE_PATH}/refresh`;

export const TRADES_FULL_PATH = `${TRADES_BASE_URL}`;
export const TRADE_FULL_PATH = `${TRADES_BASE_URL}${TRADE_PATH}`;
export const TRADE_ACCEPT_FULL_PATH = `${TRADES_BASE_URL}${TRADE_ACCEPT_PATH}`;
export const TRADE_EXCHANGE_DETAILS_FULL_PATH = `${TRADES_BASE_URL}${TRADE_EXCHANGE_DETAILS_PATH}`;
export const TRADE_RECEIVED_ITEMS_FULL_PATH = `${TRADES_BASE_URL}${TRADE_RECEIVED_ITEMS_PATH}`;
export const TRADE_CONFIRM_FULL_PATH = `${TRADES_BASE_URL}${TRADE_CONFIRMATION_PATH}`;
export const TRADE_COUNTER_FULL_PATH = `${TRADES_BASE_URL}${TRADE_COUNTER_PATH}`;

export type TradeSentEventType = 'trades.sent';
export type TradeReceivedEventType = 'trades.received';
export type TradeChangedEventType = 'trades.changed';
export type TradeConfirmationNeededEventType = 'trades.confirmation_needed';
export type TradesPolledEventType = 'trades.polled';

export const TRADE_EVENT_PREFIX = 'trades';
export const TRADE_SENT_EVENT: TradeSentEventType = `${TRADE_EVENT_PREFIX}.sent`;
export const TRADE_RECEIVED_EVENT: TradeReceivedEventType = `${TRADE_EVENT_PREFIX}.received`;
export const TRADE_CHANGED_EVENT: TradeChangedEventType = `${TRADE_EVENT_PREFIX}.changed`;
export const TRADE_CONFIRMATION_NEEDED_EVENT: TradeConfirmationNeededEventType = `${TRADE_EVENT_PREFIX}.confirmation_needed`;
export const TRADES_POLLED_EVENT: TradesPolledEventType = `${TRADE_EVENT_PREFIX}.polled`;

export type TradeSentEvent = BaseEvent<
  TradeSentEventType,
  BaseOfferEvent<Asset>
>;

export type TradeReceivedEvent = BaseEvent<
  TradeReceivedEventType,
  BaseOfferEvent<Item>
>;

export type TradeChangedEvent = BaseEvent<
  TradeChangedEventType,
  BaseOfferEvent<Item> & { oldState: ETradeOfferState | null }
>;

export type TradeConfirmationNeededEvent = BaseEvent<
  TradeConfirmationNeededEventType,
  BaseOfferEvent<Item | Asset>
>;

export type TradesPolledEvent = BaseEvent<
  TradesPolledEventType,
  { full: boolean }
>;

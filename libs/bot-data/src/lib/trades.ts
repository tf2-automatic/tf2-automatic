import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ETradeOfferState, ETradeOfferConfirmationMethod } from 'steam-user';
import SteamTradeOfferManager from 'steam-tradeoffer-manager';
import { Item } from './inventories';
import { IsSteamID } from '@tf2-automatic/is-steamid-validator';
import { BaseEvent } from './events';

export enum OfferFilter {
  ActiveOnly = 1,
  HistoricalOnly = 2,
  All = 3,
}

export class GetTradesDto {
  @IsEnum(OfferFilter)
  @Type(() => Number)
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

export interface GetTradesResponse {
  sent: TradeOffer[];
  received: TradeOffer[];
}

export type GetTradeResponse = TradeOffer;

export class Asset {
  @IsString()
  assetid: string;

  @IsNumber()
  appid: number;

  @IsString()
  contextid: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  amount?: number;
}

export class CreateTradeDto {
  @IsSteamID()
  partner: string;

  @IsOptional()
  @IsString()
  token?: string;

  @IsOptional()
  @IsString()
  message?: string;

  @IsArray()
  @ValidateNested({
    each: true,
  })
  @Type(() => Asset)
  itemsToGive: Asset[];

  @IsArray()
  @ValidateNested({
    each: true,
  })
  @Type(() => Asset)
  itemsToReceive: Asset[];
}

export type CreateTradeResponse = TradeOffer;
export type AcceptTradeResponse = TradeOffer;
export type DeleteTradeResponse = TradeOffer;

export type AcceptConfirmationResponse = {
  success: boolean;
};

export const TRADES_BASE_URL = '/trades';
export const TRADES_GET_TRADES = '/';
export const TRADES_GET_TRADE = '/:id';
export const TRADES_GET_EXCHANGE_DETAILS = '/:id/exchange';
export const TRADES_CREATE_TRADE = '/';
export const TRADES_REMOVE_TRADE = '/:id';
export const TRADES_ACCEPT_TRADE = '/:id/accept';
export const TRADES_ACCEPT_CONFIRMATION = '/:id/confirm';

export const TRADE_SENT_EVENT = 'trade.sent';
export const TRADE_RECEIVED_EVENT = 'trade.received';
export const TRADE_CHANGED_EVENT = 'trade.changed';

export interface TradeSentEvent extends BaseEvent {
  type: typeof TRADE_SENT_EVENT;
  data: TradeOffer;
}

export interface TradeReceivedEvent extends BaseEvent {
  type: typeof TRADE_RECEIVED_EVENT;
  data: TradeOffer;
}

export interface TradeChangedEvent extends BaseEvent {
  type: typeof TRADE_CHANGED_EVENT;
  data: TradeOffer;
}

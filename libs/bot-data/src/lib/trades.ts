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
import {
  ETradeOfferState,
  ETradeOfferConfirmationMethod,
  EResult,
} from 'steam-user';
import { Item } from './inventories';
import { IsSteamID } from '@tf2-automatic/is-steamid-validator';

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

export type DeleteTradeResponse = TradeOffer;

export const TRADES_BASE_URL = '/trades';
export const TRADES_GET_TRADES = '/';
export const TRADES_GET_TRADE = '/:id';
export const TRADES_CREATE_TRADE = '/';
export const TRADES_REMOVE_TRADE = '/:id';

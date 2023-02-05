import { IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { ETradeOfferState, ETradeOfferConfirmationMethod } from 'steam-user';
import { Item } from './inventories';

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

export const TRADES_BASE_URL = '/trades';
export const TRADES_GET_TRADES = '/';
export const TRADES_GET_TRADE = '/:id';

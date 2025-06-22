import { BaseEvent } from '@tf2-automatic/bot-data';
import { RequiredItemAttributes } from '@tf2-automatic/tf2-format';

export const PRICES_BASE_PATH = '/prices';
export const PRICES_PATH = '/';
export const PRICE_PATH = '/:id';

export const PRICES_FULL_PATH = `${PRICES_BASE_PATH}${PRICES_PATH}`;
export const PRICE_FULL_PATH = `${PRICES_BASE_PATH}${PRICE_PATH}`;

export interface Pure {
  halfScrap: number;
  keys: number;
}

export interface PricelistAsset {
  /**
   * The SteamID64 of the account that owns the asset
   */
  owner: string;
  /*
   * The assetid
   */
  id: string;
}

export interface Price {
  /**
   * An ID for the price.
   */
  id: string;

  /**
   * The item that the price is made for.
   */
  item: RequiredItemAttributes | null;

  /**
   * The name of the item used for indexing.
   */
  name: string | null;

  /**
   * The asset that this price is for
   */
  asset?: PricelistAsset;
  /**
   * The buy price
   */
  buy?: Pure;
  /**
   * The sell price
   */
  sell?: Pure;
  /**
   * The minimum stock
   */
  min?: number;
  /**
   * The maximum stock
   */
  max?: number;
  /**
   * When the price was created
   */
  createdAt: number;
  /**
   * When the price was last updated
   */
  updatedAt: number;
}

export interface PriceWithAsset extends Price {
  asset: PricelistAsset;
}

export interface SavePrice {
  sku?: string;
  asset?: PricelistAsset;
  buy?: Pure;
  sell?: Pure;
  min?: number;
  max?: number;
}

export interface PricesSearch {
  name?: string[];
  sku?: string[];
  assetid?: string[];
}

export interface PricesSearchResponse {
  matches: {
    [K in keyof PricesSearch]: Record<string, number[]>;
  };
  items: Price[];
}

export type PriceCreatedEventType = 'prices.created';
export const PRICE_CREATED_EVENT: PriceCreatedEventType = `prices.created`;

export type PriceCreatedEvent = BaseEvent<PriceCreatedEventType, Price>;

export type PriceDeletedEventType = 'prices.deleted';
export const PRICE_DELETED_EVENT: PriceDeletedEventType = `prices.deleted`;

export type PriceDeletedEvent = BaseEvent<PriceDeletedEventType, Price>;

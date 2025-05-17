import { BaseEvent } from '@tf2-automatic/bot-data';

export const PRICES_BASE_PATH = '/prices';
export const PRICES_PATH = '/';
export const PRICE_PATH = '/:id';
export const PRICES_SEARCH_PATH = '/search';

export const PRICES_FULL_PATH = `${PRICES_BASE_PATH}${PRICES_PATH}`;
export const PRICE_FULL_PATH = `${PRICES_BASE_PATH}${PRICE_PATH}`;
export const PRICES_SEARCH_FULL_PATH = `${PRICES_BASE_PATH}${PRICES_SEARCH_PATH}`;

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
   * The SKU of the item.
   */
  sku: string;

  /**
   * The name of the item used for indexing.
   */
  name: string;

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
   * When the price was created
   */
  createdAt: number;
  /**
   * When the price was last updated
   */
  updatedAt: number;
}

export interface SavePrice {
  sku: string;
  asset?: PricelistAsset;
  buy?: Pure;
  sell?: Pure;
}

export interface PricesSearch {
  name: string;
}

export type PriceCreatedEventType = 'prices.created';
export const PRICE_CREATED_EVENT: PriceCreatedEventType = `prices.created`;

export type PriceCreatedEvent = BaseEvent<PriceCreatedEventType, Price>;

export type PriceDeletedEventType = 'prices.deleted';
export const PRICE_DELETED_EVENT: PriceDeletedEventType = `prices.deleted`;

export type PriceDeletedEvent = BaseEvent<PriceDeletedEventType, Price>;

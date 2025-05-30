import { BaseEvent, HttpError, Item } from '@tf2-automatic/bot-data';
import { RetryOptions } from '@tf2-automatic/common-data';

export const INVENTORIES_BASE_URL = '/inventories';
export const INVENTORY_PATH = '/:steamid/:appid/:contextid';
export const INVENTORY_FETCH_PATH = `${INVENTORY_PATH}/fetch`;
export const INVENTORY_QUEUE_PATH = `${INVENTORY_PATH}/queue`;

export const INVENTORY_FULL_PATH = `${INVENTORIES_BASE_URL}${INVENTORY_PATH}`;
export const INVENTORY_FETCH_FULL_PATH = `${INVENTORIES_BASE_URL}${INVENTORY_FETCH_PATH}`;

export interface InventoryResponse {
  timestamp: number;
  ttl: number;
  items: Item[];
}

export interface EnqueueInventory {
  bot?: string;
  priority?: number;
  retry?: RetryOptions;
  ttl?: number;
  tradableOnly?: boolean;
}

export const INVENTORY_EVENT_PREFIX = 'inventories';

export type InventoryLoadedEventType = 'inventories.loaded';
export const INVENTORY_LOADED_EVENT: InventoryLoadedEventType = `${INVENTORY_EVENT_PREFIX}.loaded`;

export type InventoryLoadedEvent = BaseEvent<
  InventoryLoadedEventType,
  {
    steamid64: string;
    appid: number;
    contextid: string;
    timestamp: number;
    itemCount: number;
  }
>;

interface InventoryEventData {
  job: {
    steamid64: string;
    appid: number;
    contextid: string;
  };
  response: HttpError | null;
  error: string;
}

export type InventoryErrorEventType = 'inventories.error';
export const INVENTORY_ERROR_EVENT: InventoryErrorEventType = `${INVENTORY_EVENT_PREFIX}.error`;

export type InventoryErrorEvent = BaseEvent<
  InventoryErrorEventType,
  InventoryEventData
>;

export type InventoryFailedEventType = 'inventories.failed';
export const INVENTORY_FAILED_EVENT: InventoryFailedEventType = `${INVENTORY_EVENT_PREFIX}.failed`;

export type InventoryFailedEvent = BaseEvent<
  InventoryFailedEventType,
  InventoryEventData
>;

export type InventoryChangedEventType = 'inventories.changed';
export const INVENTORY_CHANGED_EVENT: InventoryChangedEventType = `${INVENTORY_EVENT_PREFIX}.changed`;

export enum InventoryChangedEventReason {
  Trade = 'TRADE',
  ExchangeDetails = 'EXCHANGE_DETAILS',
  TF2 = 'TF2',
}

export type InventoryChangedEvent = BaseEvent<
  InventoryChangedEventType,
  {
    steamid64: string;
    appid: number;
    contextid: string;
    gained: Item[];
    lost: Item[];
    reason: InventoryChangedEventReason;
  }
>;

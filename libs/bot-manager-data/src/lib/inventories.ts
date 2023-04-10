import { BaseEvent, HttpError, Inventory } from '@tf2-automatic/bot-data';

export const INVENTORIES_BASE_URL = '/inventories';
export const INVENTORY_PATH = '/:steamid/:appid/:contextid';

export interface InventoryResponse {
  timestamp: number;
  inventory: Inventory;
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
  InventoryFailedEvent,
  InventoryEventData
>;

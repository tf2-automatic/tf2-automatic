import { BaseEvent, Inventory } from '@tf2-automatic/bot-data';

export const INVENTORIES_BASE_URL = '/inventories';
export const INVENTORY_PATH = '/:steamid/:appid/:contextid';

export interface InventoryResponse {
  cached: boolean;
  timestamp: number;
  inventory: Inventory;
}

export type InventoryLoadedEventType = 'inventories.loaded';

export const INVENTORY_EVENT_PREFIX = 'inventories';
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

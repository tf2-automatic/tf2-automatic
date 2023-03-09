import { BaseEvent, Inventory } from '@tf2-automatic/bot-data';

export const INVENTORIES_BASE_URL = '/inventories';
export const INVENTORY_PATH = '/:steamid/:appid/:contextid';

export interface InventoryResponse {
  cached: boolean;
  timestamp: number;
  inventory: Inventory;
}

export const INVENTORY_EVENT_PREFIX = 'inventories';
export const INVENTORY_LOADED_EVENT = `${INVENTORY_EVENT_PREFIX}.loaded`;

export interface InventoryLoadedEvent extends BaseEvent {
  type: typeof INVENTORY_LOADED_EVENT;
  data: {
    steamid64: string;
    appid: number;
    contextid: string;
    timestamp: number;
    itemCount: number;
  };
}

import { Inventory } from '@tf2-automatic/bot-data';

export const INVENTORIES_BASE_URL = '/inventories';
export const INVENTORY_PATH = '/:steamid/:appid/:contextid';

export interface InventoryResponse {
  cached: boolean;
  timestamp: number;
  inventory: Inventory;
}

import { InventoryStatus } from '@tf2-automatic/bptf-manager-data';

export interface Inventory {
  status: InventoryStatus;
  // Time when the inventory was last requested to be refreshed
  refresh: number;
}

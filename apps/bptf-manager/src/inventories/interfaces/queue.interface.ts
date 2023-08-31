import { InventoryStatus } from '@tf2-automatic/bptf-manager-data';

export interface EnqueueJobData {
  steamid64: string;
}

export interface InventoriesJobData {
  steamid64: string;
  attempts: number;
  attemptsSinceLastRefresh: number;
  refreshed: number;
}

export interface InventoriesJobResult {
  done: boolean;
  status: InventoryStatus;
}

export type EnqueueJobResult = InventoryStatus;

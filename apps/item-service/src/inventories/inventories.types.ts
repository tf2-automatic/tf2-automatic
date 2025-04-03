import { InventoryJobOptions } from '@tf2-automatic/item-service-data';
import { JobData } from '@tf2-automatic/queue';

export interface InventoryJobState {
  botsAttempted?: Record<string, number>;
}

export type InventoryJobData = JobData<
  InventoryJobOptions,
  InventoryJobState,
  'load'
>;

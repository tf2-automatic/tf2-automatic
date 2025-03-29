import { JobData } from '@tf2-automatic/queue';

export interface InventoryJobOptions {
  steamid64: string;
  appid: number;
  contextid: string;
  ttl?: number;
  tradableOnly?: boolean;
}

export interface InventoryJobState {
  botsAttempted?: Record<string, number>;
}

export type InventoryJobData = JobData<InventoryJobOptions, InventoryJobState>;

import { HttpError } from '@tf2-automatic/bot-data';
import { InventoryJobOptions } from '@tf2-automatic/item-service-data';
import { JobData } from '@tf2-automatic/queue';
import { InventoryItem } from '@tf2-automatic/tf2-format';

export interface InventoryJobState {
  botsAttempted?: Record<string, number>;
}

export type InventoryJobData = JobData<
  InventoryJobOptions,
  InventoryJobState,
  'load'
>;

export interface InventoryErrorData {
  error: HttpError;
  result: null;
}

export interface InventoryResultData {
  result: InventoryItem[];
  error: null;
}

export type InventoryResult = (InventoryErrorData | InventoryResultData) & {
  timestamp: number;
  ttl?: number;
};

export type InventoryData = {
  timestamp: number;
  error?: Buffer;
  [key: `item:${string}`]: Buffer;
};

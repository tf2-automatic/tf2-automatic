import { HttpError, Inventory } from '@tf2-automatic/bot-data';
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

export interface InventoryErrorData {
  error: HttpError;
  result: null;
}

export interface InventoryResultData {
  result: Inventory;
  error: null;
}

export type InventoryResult = (InventoryErrorData | InventoryResultData) & {
  timestamp: number;
  bot: string;
  ttl?: number;
};

export type InventoryData = {
  timestamp: number;
  error?: Buffer;
  bot: string;
} & {
  [key: `item:${string}`]: Buffer;
};

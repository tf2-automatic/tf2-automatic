import { RetryOptions } from '@tf2-automatic/bot-manager-data';

export interface InventoryQueue {
  raw: {
    steamid: string;
    appid: number;
    contextid: string;
  };
  extra: Record<string, unknown>;
  bot?: string;
  retry?: RetryOptions;
}

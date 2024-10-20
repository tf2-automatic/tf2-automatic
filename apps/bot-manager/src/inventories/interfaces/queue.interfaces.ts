import { RetryOptions } from '@tf2-automatic/bot-manager-data';

export interface InventoryQueue {
  raw: {
    steamid64: string;
    appid: number;
    contextid: string;
  };
  extra: { botsAttempted?: Record<string, number> };
  bot?: string;
  retry?: RetryOptions;
  ttl?: number;
  tradableOnly?: boolean;
}

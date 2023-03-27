import { QueueTrade } from '@tf2-automatic/bot-manager-data';

export interface CreateJobQueue {
  data: {
    trade: QueueTrade;
    checkCreatedAfter?: number;
  };
  options: {
    retryFor: number;
    retryDelay: number;
    maxRetryDelay: number;
  };
}

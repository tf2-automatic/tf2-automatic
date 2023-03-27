import { QueueTrade } from '@tf2-automatic/bot-manager-data';

export interface CreateTradeQueue extends QueueTrade {
  options: {
    retryFor: number;
    retryDelay: number;
    maxRetryDelay: number;
  };
}

import { CreateTrade } from '@tf2-automatic/bot-data';
import { RetryTradeOptions } from '@tf2-automatic/bot-manager-data';

export interface CreateTradeQueue {
  data: {
    trade: CreateTrade;
    checkCreatedAfter?: number;
  };
  bot: string;
  retry: RetryTradeOptions;
}

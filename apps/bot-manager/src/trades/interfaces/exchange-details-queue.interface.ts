import { TradeOffer } from '@tf2-automatic/bot-data';
import { RetryOptions } from '@tf2-automatic/bot-manager-data';

export interface ExchangeDetailsQueueData {
  bot: string;
  offer: TradeOffer;
  retry?: RetryOptions;
}

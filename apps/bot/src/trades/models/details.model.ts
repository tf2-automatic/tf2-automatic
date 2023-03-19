import { ApiProperty } from '@nestjs/swagger';
import {
  ExchangeDetailsItem,
  TradeOfferExchangeDetails,
} from '@tf2-automatic/bot-data';
import { SteamTradeOfferManager } from 'steam-tradeoffer-manager';
import { DetailsItemModel } from './details-item.model';

export class DetailsModel implements TradeOfferExchangeDetails {
  @ApiProperty({
    type: Number,
    example: 3,
    description: 'The status of the trade and how far it is in the process',
  })
  status: SteamTradeOfferManager.ETradeStatus;

  @ApiProperty({
    type: Number,
    example: Math.floor(Date.now() / 1000),
    description: 'The time Steam started processing the trade and moving items',
  })
  tradeInitTime: number;

  @ApiProperty({
    type: [DetailsItemModel],
  })
  receivedItems: ExchangeDetailsItem[];

  @ApiProperty({
    type: [DetailsItemModel],
  })
  sentItems: ExchangeDetailsItem[];
}

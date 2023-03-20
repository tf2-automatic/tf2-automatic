import { ApiProperty } from '@nestjs/swagger';
import {
  ExchangeDetailsItem,
  GetTradesResponse,
  Item,
  TradeOffer,
  TradeOfferExchangeDetails,
} from '@tf2-automatic/bot-data';
import { ItemModel } from './inventories';
import { ETradeStatus } from 'steam-tradeoffer-manager';
import { ETradeOfferState, ETradeOfferConfirmationMethod } from 'steam-user';

export class DetailsItemModel extends ItemModel implements ExchangeDetailsItem {
  @ApiProperty({
    example: '1234567890',
    description: 'The new assetid of the item because the trade was accepted',
  })
  new_assetid?: string;

  @ApiProperty({
    example: '1234567890',
    description: 'The new contextid of the item because the trade was accepted',
  })
  new_contextid?: string;

  @ApiProperty({
    example: '1234567890',
    description:
      'The new assetid of the item because the trade was rolled back',
  })
  rollback_new_assetid?: string;

  @ApiProperty({
    example: '1234567890',
    description:
      'The new contextid of the item because the trade was rolled back',
  })
  rollback_new_contextid?: string;
}

export class DetailsModel implements TradeOfferExchangeDetails {
  @ApiProperty({
    type: Number,
    example: 3,
    description: 'The status of the trade and how far it is in the process',
  })
  status: ETradeStatus;

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

const now = Math.floor(Date.now() / 1000);

export class TradeModel implements TradeOffer {
  @ApiProperty({
    example: '76561198120070906',
    description:
      'The steamid64 of the other account in the trade (the account who sent the offer or the account who received the offer depending on `isOurOffer`)',
  })
  partner: string;

  @ApiProperty({
    example: '1234567890',
    description: 'The id of the offer',
  })
  id: string;

  @ApiProperty({
    example: 'Hello!',
    default: '',
    description: 'Message that was added to the offer when it was created',
  })
  message: string;

  @ApiProperty({
    example: ETradeOfferState.Active,
    description: 'Current state of the offer',
  })
  state: ETradeOfferState;

  @ApiProperty({
    type: [ItemModel],
    description:
      'Items that we will give to the partner when the offer is accepted',
  })
  itemsToGive: Item[];

  @ApiProperty({
    type: [ItemModel],
    description:
      'Items that we will receive from the partner when the offer is accepted',
  })
  itemsToReceive: Item[];

  @ApiProperty({
    example: false,
    description: 'If the offer is glitched (missing items)',
  })
  isGlitched: boolean;

  @ApiProperty({
    example: false,
    description: 'If the offer was made by us or the `partner`',
  })
  isOurOffer: boolean;

  @ApiProperty({
    example: now,
    description: 'Unix timestamp when the offer was created',
  })
  createdAt: number;

  @ApiProperty({
    example: now,
    description: 'Unix timestamp when the offer was last updated',
  })
  updatedAt: number;

  @ApiProperty({
    example: now + 14 * 24 * 60 * 60,
    description: 'Unix timestamp when the offer expires',
  })
  expiresAt: number;

  @ApiProperty({
    example: null,
    description:
      'If `fromRealTimeTrade` then this is the id of the real-time trade',
  })
  tradeID: string | null;

  @ApiProperty({
    example: false,
    description:
      'If the offer was made using real-time trade (this is no longer available in Steam UI but APIs still exist)',
  })
  fromRealTimeTrade: boolean;

  @ApiProperty({
    example: ETradeOfferConfirmationMethod.MobileApp,
    description:
      'When accepting the offer, this contains the confirmation method needed to confirm the offer',
  })
  confirmationMethod: ETradeOfferConfirmationMethod;

  @ApiProperty({
    example: null,
    description:
      'If the offer is in escrow, this contains the unix timestamp for when the offer leaves escrow',
  })
  escrowEndsAt: number | null;
}

export class TradesModel implements GetTradesResponse {
  @ApiProperty({
    description: 'Sent trades',
    type: [TradeModel],
  })
  sent: TradeOffer[];

  @ApiProperty({
    description: 'Received trades',
    type: [TradeModel],
  })
  received: TradeOffer[];
}

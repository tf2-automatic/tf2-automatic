import { ApiProperty } from '@nestjs/swagger';
import {
  Action,
  Description,
  Inventory,
  Item,
  Tag,
} from '@tf2-automatic/bot-data';
import { InventoryResponse } from '@tf2-automatic/bot-manager-data';

export class ItemModel implements Item {
  @ApiProperty({
    example: 440,
    description: 'The appid of the game the item is from',
  })
  appid: number;

  @ApiProperty({
    example: '2',
    description: 'The id of the inventory context the item is inside',
  })
  contextid: string;

  @ApiProperty({
    example: '1234567890',
    description: 'The assetid of the item',
  })
  assetid: string;

  @ApiProperty()
  classid: string;

  @ApiProperty()
  instanceid: string;

  @ApiProperty({
    example: 0,
    description: 'The amount of items in the stack',
  })
  amount: number;

  @ApiProperty({
    example: 0,
    description: 'The position of the item in the inventory',
  })
  pos?: number | undefined;

  @ApiProperty({
    type: Number,
  })
  currency?: number | undefined;

  @ApiProperty({
    type: Boolean,
  })
  is_currency?: boolean | undefined;

  @ApiProperty({
    example: false,
    description:
      'If the offer has state `InvalidItems` then this is set for all items missing from the inventory',
  })
  missing?: boolean | undefined;

  @ApiProperty({
    example: '228',
    description: 'The estimated price of the item in USD cents',
  })
  est_usd: string;

  @ApiProperty({
    description: 'Part of the url to an image of the item',
  })
  icon_url: string;

  @ApiProperty({
    description: 'Part of the url to an image of the item',
  })
  icon_url_large: string;

  @ApiProperty({
    type: String,
  })
  icon_drag_url?: string | undefined;

  @ApiProperty()
  name: string;

  @ApiProperty({
    description: 'The name of the item',
  })
  market_hash_name: string;

  @ApiProperty()
  market_name: string;

  @ApiProperty({
    description: 'The color of the name of the item as seen on Steam',
  })
  name_color: string;

  @ApiProperty({
    description: 'The color of the background of the item as seen on Steam',
  })
  background_color: string;

  @ApiProperty({
    description: 'The type of the item',
  })
  type: string;

  @ApiProperty({
    example: true,
    description: 'The tradable state of the item',
  })
  tradable: boolean;

  @ApiProperty({
    example: true,
    description: 'The marketable state of the item',
  })
  marketable: boolean;

  @ApiProperty()
  commodity: boolean;

  @ApiProperty({
    type: String,
  })
  market_fee_app?: string | undefined;

  @ApiProperty()
  market_tradable_restriction: number;

  @ApiProperty()
  market_marketable_restriction: number;

  @ApiProperty({
    description: 'A list of descriptions of the item',
  })
  descriptions: Description[];

  @ApiProperty({
    description: 'A list of actions that can be performed on the item',
  })
  owner_actions?: Action[] | undefined;

  @ApiProperty({
    description: 'A list of tags that the item has',
  })
  tags: Tag[];

  @ApiProperty()
  id: string;

  @ApiProperty({
    description: 'A list of fraud warnings',
  })
  fraudwarnings: unknown[];

  @ApiProperty()
  owner_descriptions?: Description[] | undefined;

  @ApiProperty({
    description: 'A list of actions that can be performed on the item',
  })
  actions: Action[];

  @ApiProperty()
  market_actions?: Action[] | undefined;

  @ApiProperty({
    description: 'An object containing additional data about the item',
  })
  app_data?: Record<string, unknown> | undefined;
}

export class CachedInventoryModel implements InventoryResponse {
  @ApiProperty({
    example: true,
    description: 'If the inventory was cached',
  })
  cached: boolean;

  @ApiProperty({
    example: Math.floor(Date.now() / 1000),
    description: 'The timestamp of when the inventory was fetched',
  })
  timestamp: number;

  @ApiProperty({
    type: [ItemModel],
    description: 'The items in the inventory',
  })
  inventory: Inventory;
}

import { ApiProperty } from '@nestjs/swagger';
import { ExchangeDetailsItem } from '@tf2-automatic/bot-data';
import { ItemModel } from '../../inventories/models/item.model';

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

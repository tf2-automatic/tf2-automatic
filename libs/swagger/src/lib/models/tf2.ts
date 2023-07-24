import { ApiProperty } from '@nestjs/swagger';
import {
  CraftRecipe,
  CraftRecipeResult,
  CraftResult,
  TF2Account,
  TF2Item,
  Attribute,
  EquippedState,
  TF2Buffer,
} from '@tf2-automatic/bot-data';

export class TF2AccountModel implements TF2Account {
  @ApiProperty({
    example: true,
    description: 'Whether the account is premium or not',
  })
  isPremium: boolean;

  @ApiProperty({
    example: 3000,
    description: 'The number of inventory slots the account has',
  })
  backpackSlots: number;
}

export class CraftResultModel implements CraftResult {
  @ApiProperty({
    enum: CraftRecipe,
    description: 'The recipe used to craft the items',
  })
  recipe: CraftRecipeResult;

  @ApiProperty({
    type: [String],
    description: 'The assetids of the items that were crafted',
  })
  assetids: string[];
}

export class TF2BufferModel implements TF2Buffer {
  @ApiProperty({
    example: 'Buffer',
  })
  type: 'Buffer';

  @ApiProperty({
    type: [Number],
    minLength: 4,
    maxLength: 4,
  })
  data: [number, number, number, number];
}

export class AttributeModel implements Attribute {
  @ApiProperty({
    type: Number,
  })
  def_index: number;

  @ApiProperty({
    deprecated: true,
  })
  value: unknown;

  @ApiProperty({
    type: TF2BufferModel,
  })
  value_bytes: TF2BufferModel;
}

export class EquippedStateModel implements EquippedState {
  @ApiProperty({
    type: Number,
  })
  new_class: number;

  @ApiProperty({
    type: Number,
  })
  new_slot: number;
}

export class TF2ItemModel implements TF2Item {
  @ApiProperty({
    type: [AttributeModel],
  })
  attribute: AttributeModel[];

  @ApiProperty({
    type: [EquippedStateModel],
  })
  equipped_state: EquippedStateModel[];

  @ApiProperty()
  id: string;

  @ApiProperty()
  account_id: number;

  @ApiProperty()
  inventory: number;

  @ApiProperty()
  def_index: number;

  @ApiProperty()
  quantity: number;

  @ApiProperty()
  level: number;

  @ApiProperty()
  quality: number;

  @ApiProperty()
  flags: number;

  @ApiProperty()
  origin: number;

  @ApiProperty({
    nullable: true,
  })
  custom_name: string | null;

  @ApiProperty({})
  custom_desc: string | null;

  @ApiProperty({
    type: TF2ItemModel,
    nullable: true,
  })
  interior_item: TF2ItemModel | null;

  @ApiProperty()
  in_use: boolean;

  @ApiProperty()
  style: number;

  @ApiProperty({
    nullable: true,
  })
  original_id: string | null;

  @ApiProperty({
    deprecated: true,
  })
  contains_equipped_state: unknown;

  @ApiProperty()
  contains_equipped_state_v2: boolean;

  @ApiProperty()
  position: number;
}

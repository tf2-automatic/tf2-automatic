import { ApiProperty } from '@nestjs/swagger';
import {
  CraftRecipe,
  CraftRecipeResult,
  CraftResult,
  TF2Account,
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

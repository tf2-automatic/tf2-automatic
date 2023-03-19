import { ApiProperty } from '@nestjs/swagger';
import {
  CraftRecipe,
  CraftRecipeResult,
  CraftResult,
} from '@tf2-automatic/bot-data';

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

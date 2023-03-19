import { ApiProperty } from '@nestjs/swagger';
import { Craft, CraftRecipe } from '@tf2-automatic/bot-data';
import { IsArray, IsEnum, IsString } from 'class-validator';

export class CraftDto implements Craft {
  @ApiProperty({
    type: [String],
    description: 'The assetids of the items that should be used to craft',
  })
  @IsString({
    each: true,
  })
  @IsArray()
  assetids: string[];

  @ApiProperty({
    enum: CraftRecipe,
    description: 'The recipe used to craft the items',
  })
  @IsEnum(CraftRecipe)
  recipe: CraftRecipe;
}

import { Craft, CraftRecipe } from '@tf2-automatic/bot-data';
import { IsArray, IsEnum, IsString } from 'class-validator';

export class CraftDto implements Craft {
  @IsString({
    each: true,
  })
  @IsArray()
  assetids: string[];

  @IsEnum(CraftRecipe)
  recipe: CraftRecipe;
}

import { IsArray, IsEnum, IsString } from 'class-validator';

export interface TF2Account {
  isPremium: boolean;
  backpackSlots: number;
}

export enum CraftRecipe {
  SmeltReclaimed = 22,
  SmeltRefined = 23,
  CombineWeapons = 3,
  CombineScrap = 4,
  CombineReclaimed = 5,
}

enum CraftRecipeResults {
  Failed = -1,
}

export type CraftRecipeResult = CraftRecipe | CraftRecipeResults;

export interface CraftResult {
  recipe: CraftRecipeResult;
  assetids: string[];
}

export class CraftDto {
  @IsString({
    each: true,
  })
  @IsArray()
  assetids: string[];

  @IsEnum(CraftRecipe)
  recipe: CraftRecipe;
}

export enum SortBackpack {
  Name = 1,
  Defindex = 2,
  Quality = 3,
  Type = 4,
  Date = 5,
  Class = 101,
  Slot = 102,
}

export class SortBackpackDto {
  @IsEnum(SortBackpack)
  sort: SortBackpack;
}

export const TF2_BASE_URL = '/tf2';
export const TF2_GET_ACCOUNT = '/account';
export const TF2_CRAFT = '/craft';
export const TF2_USE_ITEM = '/items/:id/use';
export const TF2_DELETE_ITEM = '/items/:id';
export const TF2_SORT_BACKPACK = '/sort';

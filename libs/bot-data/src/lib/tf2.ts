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

export interface TF2Item {
  attribute: unknown[];
  equipped_state: unknown[];
  id: string;
  account_id: number;
  inventory: number;
  def_index: number;
  quantity: number;
  level: number;
  quality: number;
  flags: number;
  origin: number;
  custom_name: string | null;
  custom_desc: string | null;
  interior_item: null;
  in_use: boolean;
  style: number;
  original_id: string;
  contains_equipped_state: null;
  contains_equipped_state_v2: boolean;
  position: number;
}

export const TF2_BASE_URL = '/tf2';
export const TF2_ACCOUNT_PATH = '/account';
export const TF2_CRAFT_PATH = '/craft';
export const TF2_ITEM_PATH = '/items/:id';
export const TF2_USE_ITEM_PATH = `${TF2_ITEM_PATH}/use`;
export const TF2_SORT_PATH = '/sort';

export const TF2_EVENT_PREFIX = 'tf2';
export const TF2_GAINED_EVENT = `${TF2_EVENT_PREFIX}.gained`;
export const TF2_LOST_EVENT = `${TF2_EVENT_PREFIX}.lost`;

export interface TF2GainedEvent {
  type: typeof TF2_GAINED_EVENT;
  data: TF2Item;
}

export interface TF2LostEvent {
  type: typeof TF2_LOST_EVENT;
  data: TF2Item;
}

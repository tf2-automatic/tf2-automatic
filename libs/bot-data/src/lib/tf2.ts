import { BaseEvent } from './events';

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

export interface Craft {
  assetids: string[];
  recipe: CraftRecipe;
}

export enum SortBackpackTypes {
  Name = 1,
  Defindex = 2,
  Quality = 3,
  Type = 4,
  Date = 5,
  Class = 101,
  Slot = 102,
}

export interface SortBackpack {
  sort: SortBackpackTypes;
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

export interface TF2ActionResult {
  success: boolean;
}

export const TF2_BASE_URL = '/tf2';
export const TF2_ACCOUNT_PATH = '/account';
export const TF2_CRAFT_PATH = '/craft';
export const TF2_ITEM_PATH = '/items/:id';
export const TF2_USE_ITEM_PATH = `${TF2_ITEM_PATH}/use`;
export const TF2_SORT_PATH = '/sort';

export type TF2GainedEventType = 'tf2.gained';
export type TF2LostEventType = 'tf2.lost';

export const TF2_EVENT_PREFIX = 'tf2';
export const TF2_GAINED_EVENT: TF2GainedEventType = `${TF2_EVENT_PREFIX}.gained`;
export const TF2_LOST_EVENT: TF2LostEventType = `${TF2_EVENT_PREFIX}.lost`;

export type TF2GainedEvent = BaseEvent<TF2GainedEventType, TF2Item>;

export type TF2LostEvent = BaseEvent<TF2LostEventType, TF2Item>;

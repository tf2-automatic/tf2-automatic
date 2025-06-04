import { RecipeInput, Spell } from '../../types';

export interface TF2APIItem {
  id: number;
  original_id: number;
  defindex: number;
  level: number;
  quality: number;
  inventory: number;
  quantity: number;
  origin: number;
  flag_cannot_trade?: boolean;
  attributes?: Attribute[];
  equipped?: Equipped[];
  style?: number;
  flag_cannot_craft?: boolean;
  custom_name?: string;
  custom_desc?: string;
}

export interface Attribute {
  defindex: number;
  value?: string | number;
  float_value?: number;
  account_info?: AccountInfo;
  is_output?: boolean;
  quantity?: number;
  quality?: number;
  match_all_attribs?: boolean;
  attributes?: Attribute[];
  itemdef?: number;
}

export interface AccountInfo {
  steamid: number;
  personaname: string;
}

export interface Equipped {
  class: number;
  slot: number;
}

export interface ExtractedTF2APIItem {
  assetid: string;
  originalId: string | null;
  level: number;
  defindex: number;
  quality: number;
  craftable: boolean;
  tradable: boolean;
  elevated: boolean;
  australium: boolean;
  festivized: boolean;
  effect: number | null;
  wear: number | null;
  primaryPaint: number | null;
  secondaryPaint: number | null;
  killstreak: number;
  sheen: number | null;
  killstreaker: number | null;
  spells: Spell[];
  parts: number[];
  paintkit: number | null;
  quantity: number;
  inputs: RecipeInput[] | null;
  output: number | null;
  outputQuality: number | null;
  target: number | null;
  crateSeries: number | null;
}

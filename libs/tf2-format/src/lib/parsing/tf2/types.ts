import { RecipeInput, Spell } from '../../types';

export interface TF2Item {
  attribute: Attribute[];
  equipped_state: EquippedState[];
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
  interior_item: TF2Item | null;
  in_use: boolean;
  style: number;
  original_id: string | null;
  position: number;
}

export interface EquippedState {
  new_class: number;
  new_slot: number;
}

export interface Attribute {
  def_index: number;
  value: unknown;
  value_bytes: ValueBytes | Buffer;
}

export interface ValueBytes {
  type: 'Buffer';
  data: number[];
}

export interface Attributes {
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
  inputs: RecipeInput[] | null;
  output: number | null;
  outputQuality: number | null;
  target: number | null;
}

/**
 * The result of extracting information from an TF2Item
 */
export interface ExtractedTF2Item {
  assetid: string;
  originalId: string | null;
  level: number;
  defindex: number;
  quality: number;
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

export interface Context {
  origin: number;
  flags: number;
  attributes: Set<number>;
}

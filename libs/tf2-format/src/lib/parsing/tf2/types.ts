import { RecipeInput } from '../../types';

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
  contains_equipped_state: null;
  contains_equipped_state_v2: boolean;
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
  [key: string]: any;
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
  primaryPaint: string | null;
  secondaryPaint: string | null;
  killstreak: number;
  sheen: number | null;
  killstreaker: number | null;
  /**
   * Either the defindex of the spell, or an array with the defindex and value
   * of the attribute.
   */
  spells: (number | [number, number])[];
  parts: number[];
  paintkit: number | null;
  quantity: number | null;
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

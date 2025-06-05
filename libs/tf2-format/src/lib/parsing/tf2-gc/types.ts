import { ExtractedTF2Item } from '../tf2/types';

export interface TF2GCItem {
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
  interior_item: TF2GCItem | null;
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

/**
 * The result of extracting information from an TF2Item
 */
export type ExtractedTF2GCItem = ExtractedTF2Item;

export interface Context {
  origin: number;
  flags: number;
  attributes: Set<number>;
}

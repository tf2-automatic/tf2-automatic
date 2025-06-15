import { ExtractedTF2Item } from '../tf2/types';

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

export interface ExtractedTF2APIItem extends ExtractedTF2Item {
  originalId: string;
  craftable: boolean;
  tradable: boolean;
}

export interface Context {
  craftable: boolean;
  tradable: boolean;
}

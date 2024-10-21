import { Schema } from './schema';

export interface Item {
  defindex: number;
  quality: number;
  elevated: boolean;
  craftable: boolean;
  tradable: boolean;
  australium: boolean;
  festivized: boolean;
  spells: number[];
  parts: number[];
  killstreak: number | null;
  sheen: string | null;
  killstreaker: string | null;
  effect: number | null;
  paintkit: number | null;
  wear: number | null;
  target: number | null;
  output: number | null;
  outputQuality: number | null;
}

export interface InventoryItem extends Item {
  assetid: string;
}

export abstract class Parser<T> {
  constructor(protected readonly schema: Schema) {}

  abstract parse(item: T): Promise<InventoryItem>;
}

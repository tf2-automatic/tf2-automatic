/**
 * A common representation of a TF2 item.
 */
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
  paint: number | null;
  wear: number | null;
  target: number | null;
  output: number | null;
  outputQuality: number | null;
  crateSeries: number | null;
}

/**
 * A TF2 item from an inventory.
 */
export interface InventoryItem extends Item {
  assetid: string;
}

/**
 * Various information needs to be retrieved externally to format the items.
 * This schema is used to define the getters for this information.
 */
export interface Schema {
  getQualityByName(name: string): number | undefined;
  fetchQualityByName(name: string): Promise<number>;
  getEffectByName(name: string): number | undefined;
  fetchEffectByName(name: string): Promise<number>;
  getTextureByName(name: string): number | undefined;
  fetchTextureByName(name: string): Promise<number>;
  getDefindexByName(name: string): number | undefined;
  fetchDefindexByName(name: string): Promise<number>;
  getSpellByName(name: string): number | undefined;
  fetchSpellByName(name: string): Promise<number>;
}
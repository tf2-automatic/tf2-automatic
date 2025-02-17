/**
 * A common representation of a TF2 item.
 */
export type Item = PrimaryItemAttributes & ExtraItemAttributes;

/**
 * A TF2 item from an inventory.
 */
export interface InventoryItem extends Item {
  assetid: string;
}

/**
 * The primary attributes of a TF2 item that are used to identify it.
 */
export interface PrimaryItemAttributes {
  defindex: number;
  quality: number;
  craftable: boolean;
  tradable: boolean;
  australium: boolean;
  festivized: boolean;
  killstreak: number;
  effect: number | null;
  paintkit: number | null;
  wear: number | null;
  target: number | null;
  output: number | null;
  outputQuality: number | null;
  elevated: boolean;
  crateSeries: number | null;
}

export interface RecipeInput {
  defindex?: number;
  killstreak?: number;
  quality: number;
  amount: number;
}

/**
 * Extra attributes of a TF2 item.
 */
export interface ExtraItemAttributes {
  paint: number | null;
  spells: number[];
  parts: number[];
  sheen: string | null;
  killstreaker: string | null;
  inputs: RecipeInput[] | null;
}

type RequiredKeys<T extends keyof U, U> = {
  [K in T]-?: K extends keyof U ? U[K] : never; // Required keys
} & {
  [K in Exclude<keyof U, T>]?: U[K]; // Optional keys
};

export type RequiredItemAttributes = RequiredKeys<
  'defindex' | 'quality',
  PrimaryItemAttributes
>;

export interface StrangePart {
  name: string;
  defindex: number;
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
  /**
   * Gets the defindex of an item by its name.
   * @param name The name of the item
   * @returns Returns null if an item with the given name does not exist.
   */
  getDefindexByName(name: string): number | null | undefined;
  /**
   * Gets the defindex of an item by its name.
   * @param name The name of the item.
   * @returns Returns null if an item with the given name does not exist.
   */
  fetchDefindexByName(name: string): Promise<number | null>;
  getSpellByName(name: string): number | undefined;
  fetchSpellByName(name: string): Promise<number>;
  /**
   * Gets the defindex and name of a strange part by its score type.
   * @param name The score type name.
   * @returns Returns null if a strange part with the given score type does not exist.
   */
  getStrangePartByScoreType(name: string): StrangePart | null | undefined;
  /**
   * Gets the defindex and name of a strange part by its score type.
   * @param name The score type name.
   * @returns Returns null if a strange part with the given score type does not exist.
   */
  fetchStrangePartByScoreType(name: string): Promise<StrangePart | null>;
}

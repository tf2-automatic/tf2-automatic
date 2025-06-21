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

export interface PossibleInventoryItem extends Item {
  assetid: string | null;
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
  effect: NumberOrNull;
  paintkit: NumberOrNull;
  wear: NumberOrNull;
  target: NumberOrNull;
  output: NumberOrNull;
  outputQuality: NumberOrNull;
  elevated: boolean;
  crateSeries: NumberOrNull;
}

export interface RecipeInput {
  defindex?: number;
  killstreak?: number;
  quality: number;
  quantity: number;
}

/**
 * Extra attributes of a TF2 item.
 */
export interface ExtraItemAttributes {
  paint: NumberOrNull;
  spells: Spell[];
  parts: number[];
  sheen: NumberOrNull;
  killstreaker: NumberOrNull;
  inputs: RecipeInput[] | null;
  quantity: number;
}

export type Spell = [defindex: number, value: number];

type RequiredKeys<T extends keyof U, U> = {
  [K in T]-?: K extends keyof U ? U[K] : never; // Required keys
} & {
  [K in Exclude<keyof U, T>]?: U[K]; // Optional keys
};

export type RequiredItemAttributes = RequiredKeys<'defindex' | 'quality', Item>;

export interface ItemsGameItem {
  name: string;
  capabilities?: Record<string, '0' | '1'>;
  static_attrs?: Record<string, string>;
  attributes?: Record<
    string,
    {
      attribute_class: string;
      value: string;
    }
  >;
}

export interface SchemaItem {
  defindex: number;
  item_name: string;
  proper_name: boolean;
  item_quality: number;
}

export type UndefinedOrError<T> = T | undefined | Error;
export type UndefinedOrNull<T> = T | undefined | null;
export type NumberOrNull = number | null;

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

/**
 * Various information needs to be retrieved externally to format the items.
 * This schema is used to define the getters for this information.
 */
export interface EconParserSchema {
  /**
   * Syncronously get the defindex of an item by its `item_name` using the
   * GetSchemaItems API.
   * @param name The name of the item.
   * @returns Returns the defindex of the item, null if an item with the given
   * name is known not to exist or undefined if it could not be found syncronously.
   * @example schema.getDefindexByName("Mann Co. Supply Crate Key") -> 5021
   * @example schema.getDefindexByName("Mann Co. Supply Crate Key") -> undefined
   * @example schema.getDefindexByName("Non-existent item") -> null
   */
  getDefindexByName(name: string): number | null | undefined;
  /**
   * Asyncronously get the defindex of an item by its `item_name` using
   * the GetSchemaItems API.
   * @param name The name of the item.
   * @returns Returns the defindex of the item or null if an item with the given
   * name does not exist.
   * @example schema.fetchDefindexByName("Mann Co. Supply Crate Key") -> Promise.resolve(5021)
   * @example schema.fetchDefindexByName("Non-existent item") -> Promise.resolve(null)
   */
  fetchDefindexByName(name: string): Promise<number | null>;
  /**
   * Synchronously get an item by its defindex from items_game.txt.
   * @param defindex The defindex of the item.
   * @returns Returns the matching item from items_game.txt, undefined if it
   * is not possible to get the item synchronously or an error to exit early.
   * @example schema.getItemByDefindex(5021) -> { name: "Decoder Ring", ... }
   * @example schema.getItemByDefindex(-1) -> undefined
   * @example schema.getItemByDefindex(-1) -> new Error("Item not found")
   */
  getItemByDefindex(defindex: number): ItemsGameItem | undefined | Error;
  /**
   * Asynchronously get an item by its defindex from items_game.txt.
   * @param defindex The defindex of the item.
   * @returns Returns the matching item from items_game.txt or throws an error
   * if it was not found.
   * @example schema.fetchItemByDefindex(5021) -> Promise.resolve({ name: "Decoder Ring", ... })
   * @example schema.fetchItemByDefindex(-1) -> Promise.reject(new Error("Item not found"))
   */
  fetchItemByDefindex(defindex: number): Promise<ItemsGameItem>;
  /**
   * Synchronously get the id of a quality by its name.
   * @param name The name of the quality.
   * @returns Returns the id of the quality, undefined if the quality cannot be
   * found syncronously or an error to exit early.
   * @example schema.getQualityByName("Unique") -> 6
   * @example schema.getQualityByName("Non-existent quality") -> undefined
   * @example schema.getQualityByName("Non-existent quality") -> new Error("Quality not found")
   */
  getQualityByName(name: string): number | undefined | Error;
  /**
   * Asynchronously get the id of a quality by its name.
   * @param name The name of the quality.
   * @returns Returns the id of the quality or throws an error if the quality
   * cannot be found.
   * @example schema.fetchQualityByName("Unique") -> Promise.resolve(6)
   * @example schema.fetchQualityByName("Non-existent quality") -> Promise.reject(new Error("Quality not found"))
   */
  fetchQualityByName(name: string): Promise<number>;
  /**
   * Synchronously get the id of an effect by its name.
   * @param name The name of the effect.
   * @returns Returns the id of the effect, undefined if the effect cannot be
   * found synchronously or an error to exit early.
   * @example schema.getEffectByName("Burning Flames") -> 13
   * @example schema.getEffectByName("Non-existent effect") -> undefined
   * @example schema.getEffectByName("Non-existent effect") -> new Error("Effect not found")
   */
  getEffectByName(name: string): number | undefined | Error;
  /**
   * Asynchronously get the id of an effect by its name.
   * @param name The name of the effect.
   * @returns Returns the id of the effect or throws an error if the effect
   * cannot be found.
   * @example schema.fetchEffectByName("Burning Flames") -> Promise.resolve(13)
   * @example schema.fetchEffectByName("Non-existent effect") -> Promise.reject(new Error("Effect not found"))
   */
  fetchEffectByName(name: string): Promise<number>;
  /**
   * Synchronously get the id of a texture by its name.
   * @param name The name of the texture.
   * @returns Returns the id of the texture, undefined if the texture cannot be
   * found synchronously or an error to exit early.
   * @example schema.getTextureByName("Night Owl") -> 14
   * @example schema.getTextureByName("Non-existent texture") -> undefined
   * @example schema.getTextureByName("Non-existent texture") -> new Error("Texture not found")
   */
  getTextureByName(name: string): number | undefined | Error;
  /**
   * Asynchronously get the id of a texture by its name.
   * @param name The name of the texture.
   * @returns Returns the id of the texture or throws an error if the texture
   * cannot be found.
   * @example schema.fetchTextureByName("Night Owl") -> Promise.resolve(14)
   * @example schema.fetchTextureByName("Non-existent texture") -> Promise.reject(new Error("Texture not found"))
   */
  fetchTextureByName(name: string): Promise<number>;
  /**
   * Syncronously get the id of a spell by its name.
   * @param name The name of the spell.
   * @returns Returns the id of the spell, undefined if the spell cannot be
   * found syncronously or an error to exit early.
   * @example schema.getSpellByName("Exorcism") -> 1009
   * @example schema.getSpellByName("Non-existent spell") -> undefined
   * @example schema.getSpellByName("Non-existent spell") -> new Error("Spell not found")
   */
  getSpellByName(name: string): number | undefined | Error;
  /**
   * Asynchronously get the id of a spell by its name.
   * @param name The name of the spell.
   * @returns Returns the id of the spell or throws an error if the spell
   * cannot be found.
   * @example schema.fetchSpellByName("Exorcism") -> Promise.resolve(1009)
   * @example schema.fetchSpellByName("Non-existent spell") -> Promise.reject(new Error("Spell not found"))
   */
  fetchSpellByName(name: string): Promise<number>;
  /**
   * Syncronously get the defindex of a strange part by its score type. Because
   * some score types may not have a corresponding strange part, e.g. "Kills", then
   * this method has to return null when no match instead of throwing an error.
   * @param scoreType The score type.
   * @returns Returns the id of the strange part, null if a strange part with the
   * given score type does not exist or undefined if it could not be found syncronously.
   * @example schema.getStrangePartByScoreType("Kills Under A Full Moon") -> 6015
   * @example schema.getStrangePartByScoreType("Kills Under A Full Moon") -> undefined
   * @example schema.getStrangePartByScoreType("Non-existent score type") -> null
   */
  getStrangePartByScoreType(scoreType: string): number | null | undefined;
  /**
   * Asynchronously get the defindex of a strange part by its score type. Because
   * some score types may not have a corresponding strange part, e.g. "Kills", then
   * this method has to return null when no match instead of throwing an error.
   * @param scoreType The score type.
   * @returns Returns the id of the strange part or null if a strange part with
   * the given score type does not exist.
   * @example schema.fetchStrangePartByScoreType("Kills Under A Full Moon") -> Promise.resolve(6015)
   * @example schema.fetchStrangePartByScoreType("Non-existent score type") -> Promise.resolve(null)
   */
  fetchStrangePartByScoreType(scoreType: string): Promise<number | null>;
}

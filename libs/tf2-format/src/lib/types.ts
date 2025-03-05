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

interface GetItem {
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
}

/**
 * Various information needs to be retrieved externally to format the Econ items.
 * This schema is used to define the getters for this information.
 */
export interface EconParserSchema extends GetItem {
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

/**
 * Various information needs to be retrieved externally to format the TF2 items.
 * This schema is used to define the getters for this information.
 */
export interface TF2ParserSchema extends GetItem {
  /**
   * Syncronously get the name of a sheen by its id.
   * @param id The id of the sheen.
   * @returns Returns the name of the sheen, undefined if the sheen cannot be
   * found syncronously or an error to exit early.
   * @example schema.getSheenById(6) -> "Villainous Violet"
   * @example schema.getSheenById(6) -> undefined
   * @example schema.getSheenById(-1) -> new Error("Sheen not found")
   */
  getSheenById(id: number): string | undefined | Error;
  /**
   * Asynchronously get the name of a sheen by its id.
   * @param id The id of the sheen.
   * @returns Returns the name of the sheen or throws an error if the sheen
   * cannot be found.
   * @example schema.fetchSheenById(6) -> Promise.resolve("Villainous Violet")
   * @example schema.fetchSheenById(-1) -> Promise.reject(new Error("Sheen not found"))
   */
  fetchSheenById(id: number): Promise<string>;
  /**
   * Syncronously get the name of a killstreaker by its id.
   * @param id The id of the killstreaker.
   * @returns Returns the name of the killstreaker, undefined if the killstreaker
   * cannot be found syncronously or an error to exit early.
   * @example schema.getKillstreakerById(2003) -> "Cerebral Discharge"
   * @example schema.getKillstreakerById(2003) -> undefined
   * @example schema.getKillstreakerById(-1) -> new Error("Killstreaker not found")
   */
  getKillstreakerById(id: number): string | undefined | Error;
  /**
   * Asynchronously get the name of a killstreaker by its id.
   * @param id The id of the killstreaker.
   * @returns Returns the name of the killstreaker or throws an error if the
   * killstreaker cannot be found.
   * @example schema.fetchKillstreakerById(2003) -> Promise.resolve("Cerebral Discharge")
   * @example schema.fetchKillstreakerById(-1) -> Promise.reject(new Error("Killstreaker not found"))
   */
  fetchKillstreakerById(id: number): Promise<string>;
  /**
   * Syncronously get the defindex of a spell by the attribute defindex and value.
   * @param defindex The defindex of the spell attribute.
   * @param id The value of the spell attribute.
   * @returns Returns the defindex of the spell, undefined if the spell cannot
   * be found syncronously or an error to exit early.
   * @example schema.getSpellById(1004, 1) -> 8902
   * @example schema.getSpellById(1004, 1) -> undefined
   * @example schema.getSpellById(-1, -1) -> new Error("Spell not found")
   */
  getSpellById(defindex: number, id: number): number | undefined | Error;
  /**
   * Asynchronously get the defindex of a spell by the attribute defindex and value.
   * @param defindex The defindex of the spell attribute.
   * @param id The value of the spell attribute.
   * @returns Returns the defindex of the spell or throws an error if the spell
   * cannot be found.
   * @example schema.fetchSpellById(1004, 1) -> Promise.resolve(8902)
   * @example schema.fetchSpellById(1004, 1) -> Promise.reject(new Error("Spell not found"))
   */
  fetchSpellById(defindex: number, id: number): Promise<number>;
  /**
   * Syncronously get the defindex of a paint by its hex color code.
   * @param color The hex color code of the paint.
   * @returns Returns the defindex of the paint, undefined if the paint cannot
   * be found syncronously or an error to exit early.
   * @example schema.getPaintByColor("e7b53b") -> 5037
   * @example schema.getPaintByColor("e7b53b") -> undefined
   * @example schema.getPaintByColor("") -> new Error("Paint not found")
   */
  getPaintByColor(color: string): number | undefined | Error;
  /**
   * Asynchronously get the defindex of a paint by its hex color code.
   * @param color The hex color code of the paint.
   * @returns Returns the defindex of the paint or throws an error if the paint
   * cannot be found.
   * @example schema.fetchPaintByColor("e7b53b") -> Promise.resolve(5037)
   * @example schema.fetchPaintByColor("e7b53b") -> Promise.reject(new Error("Paint not found"))
   */
  fetchPaintByColor(color: string): Promise<number>;
  /**
   * Syncronously get the defindex of a strange part by its id.
   * @param id The id of the strange part.
   * @returns Returns the defindex of the strange part, undefined if the strange
   * part cannot be found syncronously or an error to exit early.
   * @example schema.getStrangePartById(27) -> 6015
   * @example schema.getStrangePartById(27) -> undefined
   * @example schema.getStrangePartById(-1) -> new Error("Strange part not found")
   */
  getStrangePartById(id: number): number | undefined | Error;
  /**
   * Asynchronously get the defindex of a strange part by its id.
   * @param id The id of the strange part.
   * @returns Returns the defindex of the strange part or throws an error if the
   * strange part cannot be found.
   * @example schema.fetchStrangePartById(27) -> Promise.resolve(6015)
   * @example schema.fetchStrangePartById(-1) -> Promise.reject(new Error("Strange part not found"))
   */
  fetchStrangePartById(id: number): Promise<number>;
}

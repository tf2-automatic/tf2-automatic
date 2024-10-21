/**
 * Various information needs to be retrieved externally to format the items.
 * This schema is used to define the getters for this information.
 */
export interface Schema {
  getQualityByName(name: string): number | null | undefined;
  fetchQualityByName(name: string): Promise<number | null>;
  getEffectByName(name: string): number | null | undefined;
  fetchEffectByName(name: string): Promise<number | null>;
  getTextureByName(name: string): number | null | undefined;
  fetchTextureByName(name: string): Promise<number | null>;
  getDefindexByName(name: string): number | null | undefined;
  fetchDefindexByName(name: string): Promise<number | null>;
  getSpellByName(name: string): number | null | undefined;
  fetchSpellByName(name: string): Promise<number | null>;
}

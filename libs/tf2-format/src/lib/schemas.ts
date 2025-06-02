import {
  ItemsGameItem,
  NumberOrNull,
  SchemaItem,
  UndefinedOrError,
  UndefinedOrNull,
} from './types';

export interface ItemsGameItemByDefindex {
  getItemsGameItemByDefindex(defindex: number): UndefinedOrError<ItemsGameItem>;
  fetchItemsGameItemByDefindex(defindex: number): Promise<ItemsGameItem>;
}

export interface SchemaItemByDefindex {
  getSchemaItemByDefindex(defindex: number): UndefinedOrError<SchemaItem>;
  fetchSchemaItemByDefindex(defindex: number): Promise<SchemaItem>;
}

export interface DefindexByName {
  getDefindexByName(name: string): UndefinedOrError<number>;
  fetchDefindexByName(name: string): Promise<NumberOrNull>;
}

export interface QualityByName {
  getQualityByName(name: string): UndefinedOrError<number>;
  fetchQualityByName(name: string): Promise<number>;
}

export interface QualityById {
  getQualityById(id: number): UndefinedOrError<string>;
  fetchQualityById(id: number): Promise<string>;
}

export interface EffectById {
  getEffectById(id: number): UndefinedOrError<string>;
  fetchEffectById(id: number): Promise<string>;
}

export interface PaintkitById {
  getPaintkitById(id: number): UndefinedOrError<string>;
  fetchPaintkitById(id: number): Promise<string>;
}

export interface EffectByName {
  getEffectByName(name: string): UndefinedOrError<number>;
  fetchEffectByName(name: string): Promise<number>;
}

export interface TextureByName {
  getTextureByName(name: string): UndefinedOrError<number>;
  fetchTextureByName(name: string): Promise<number>;
}

export interface SpellByName {
  getSpellByName(name: string): UndefinedOrError<number>;
  fetchSpellByName(name: string): Promise<number>;
}

export interface StrangePartByScoreType {
  getStrangePartByScoreType(scoreType: string): UndefinedOrNull<number>;
  fetchStrangePartByScoreType(scoreType: string): Promise<NumberOrNull>;
}

export interface SheenByName {
  getSheenByName(name: string): UndefinedOrError<number>;
  fetchSheenByName(name: string): Promise<number>;
}

export interface KillstreakerByName {
  getKillstreakerByName(name: string): UndefinedOrError<number>;
  fetchKillstreakerByName(name: string): Promise<number>;
}

export interface SpellById {
  getSpellById(defindex: number, id: number): UndefinedOrError<number>;
  fetchSpellById(defindex: number, id: number): Promise<number>;
}

export interface PaintByColor {
  getPaintByColor(color: string): UndefinedOrError<number>;
  fetchPaintByColor(color: string): Promise<number>;
}

export interface StrangePartById {
  getStrangePartById(id: number): UndefinedOrError<number>;
  fetchStrangePartById(id: number): Promise<number>;
}

export type ItemNamingSchema = SchemaItemByDefindex &
  QualityById &
  PaintkitById &
  EffectById;

export type EconParserSchema = ItemsGameItemByDefindex &
  DefindexByName &
  QualityByName &
  EffectByName &
  TextureByName &
  SpellByName &
  StrangePartByScoreType &
  SheenByName &
  KillstreakerByName;

export type TF2ParserSchema = ItemsGameItemByDefindex &
  SpellById &
  PaintByColor &
  StrangePartById;

export type BptfParserSchema = DefindexByName & QualityByName & SpellByName;

import { SchemaItem } from '../../types';
import { ExtractedRecipeInput } from '../econ/types';

export interface BptfItem {
  appid: number;
  baseName: string;
  defindex: number;
  id: string;
  originalId: string;
  quality: IdNameAndColor;
  elevatedQuality?: IdNameAndColor;
  texture?: Texture;
  particle?: IdAndName;
  tradable?: boolean;
  australium?: boolean;
  festivized?: boolean;
  craftable?: boolean;
  quantity?: number;
  priceindex?: string;
  killstreakTier?: number;
  spells?: Spell[];
  wearTier?: IdAndName;
  recipe?: Recipe;
  sheen?: IdAndName;
  killstreaker?: IdAndName;
  crateSeries?: number;
  paint?: IdNameAndColor;
  level?: number;
  killEaters?: KillEater[];
  strangeParts?: StrangePart[];
  craftNumber?: number;
}

interface Spell {
  name: string;
}

interface KillEater {
  killEater: NameAndMaybeId;
}

interface StrangePart {
  killEater: IdAndName & { item: BptfItem };
}

interface IdAndName {
  id: number;
  name: string;
}

interface IdNameAndColor extends IdAndName {
  color: string;
}

interface NameAndMaybeId {
  id?: number;
  name: string;
}

interface Recipe {
  inputItems: ExtractedRecipeInput[];
  outputItem: BptfItem | null;
  targetItem: TargetItem | null;
}

interface TargetItem {
  itemName: string;
  // Does not seem intended that the API exposes this...
  _source: SchemaItem;
}

interface Texture extends IdAndName {
  itemDefindex: number;
  rarity: IdNameAndColor;
}

export interface BptfExtractedItem {
  assetid: string | null;
  originalId: string | null;
  level: number | null;
  defindex: number;
  quality: number;
  elevatedQuality: number | null;
  craftable: boolean;
  tradable: boolean;
  australium: boolean;
  festivized: boolean;
  effect: number | null;
  wear: number | null;
  paint: number | null;
  killstreak: number;
  sheen: number | null;
  killstreaker: number | null;
  spells: string[];
  parts: number[];
  paintkit: number | null;
  quantity: number | null;
  inputs: ExtractedRecipeInput[] | null;
  output: number | null;
  outputQuality: number | null;
  target: number | null;
  crateSeries: number | null;
}

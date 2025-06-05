import { RecipeInput, Spell } from '../../types';

export interface ExtractedTF2Item {
  assetid: string;
  originalId: string | null;
  level: number;
  defindex: number;
  quality: number;
  elevated: boolean;
  australium: boolean;
  festivized: boolean;
  effect: number | null;
  wear: number | null;
  primaryPaint: number | null;
  secondaryPaint: number | null;
  killstreak: number;
  sheen: number | null;
  killstreaker: number | null;
  spells: Spell[];
  parts: number[];
  paintkit: number | null;
  quantity: number;
  inputs: RecipeInput[] | null;
  output: number | null;
  outputQuality: number | null;
  target: number | null;
  crateSeries: number | null;
}

export interface Attributes {
  australium: boolean;
  festivized: boolean;
  effect: number | null;
  wear: number | null;
  primaryPaint: number | null;
  secondaryPaint: number | null;
  killstreak: number;
  sheen: number | null;
  killstreaker: number | null;
  spells: Spell[];
  parts: number[];
  paintkit: number | null;
  inputs: RecipeInput[] | null;
  output: number | null;
  outputQuality: number | null;
  target: number | null;
  killEater: boolean;
  crateSeries: number | null;
  quantity: number | null;
}

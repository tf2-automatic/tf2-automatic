export interface EconItem {
  appid: number;
  contextid: string;
  assetid: string;
  classid: string;
  instanceid: string;
  amount: string | number;
  pos?: number;
  id: string;
  currency?: number;
  background_color: string;
  icon_url: string;
  icon_url_large: string;
  tradable: boolean;
  actions: Action[];
  name: string;
  name_color: string;
  type: string;
  market_name: string;
  market_hash_name: string;
  commodity: boolean;
  market_tradable_restriction: number;
  market_marketable_restriction: number;
  marketable: boolean;
  tags: Tag[];
  is_currency?: boolean;
  fraudwarnings: string[];
  descriptions: Description[];
  market_actions?: MarketAction[];
}

export interface Action {
  link: string;
  name: string;
}

export interface Tag {
  internal_name: string;
  name: string;
  category: string;
  color: string;
  category_name: string;
}

export interface Description {
  value: string;
  color?: string;
  type?: string;
}

export interface MarketAction {
  link: string;
  name: string;
}

export interface ExtractedRecipeInput {
  name: string;
  amount: number;
}

export interface TagAttributes {
  Quality?: string;
  Exterior?: string;
  Rarity?: string;
  Type?: string;
}

export interface DescriptionAttributes {
  craftable: boolean;
  effect: string | null;
  killstreak: boolean;
  sheen: string | null;
  killstreaker: string | null;
  spells: string[];
  parts: string[];
  paint: string | null;
  festivized: boolean;
  paintkit: string | null;
  uses: number | null;
  inputs: ExtractedRecipeInput[] | null;
  output: string | null;
  target: string | null;
  grade: string | null;
  statclock: boolean;
}

/**
 * The result of extracting information from an EconItem
 */
export interface ExtractedEconItem {
  type: string | null;
  assetid: string;
  defindex: number | null;
  quality: string | null;
  elevated: boolean;
  craftable: boolean;
  tradable: boolean;
  australium: boolean;
  festivized: boolean;
  effect: string | null;
  wear: string | null;
  paint: string | null;
  killstreak: number;
  sheen: string | null;
  killstreaker: string | null;
  spells: string[];
  parts: string[];
  paintkit: string | null;
  uses: number | null;
  inputs: ExtractedRecipeInput[] | null;
  output: string | null;
  outputQuality: string | null;
  target: string | null;
  crateSeries: number | null;
}

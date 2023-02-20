export interface Description {
  type: string;
  value: string;
}

export interface Action {
  name: string;
  link: string;
}

export interface Tag {
  internal_name: string;
  name: string;
  category: string;
  category_name: string;
  localized_tag_name: string;
  color: string;
  category_name_color: string;
}

export interface Item {
  appid: number;
  contextid: string;
  assetid: string;
  classid: string;
  instanceid: string;
  amount: number;
  pos?: number;
  currency?: number;
  is_currency?: boolean;
  missing?: boolean;
  est_usd: string;
  icon_url: string;
  icon_url_large: string;
  icon_drag_url?: string;
  name: string;
  market_hash_name: string;
  market_name: string;
  name_color: string;
  background_color: string;
  type: string;
  tradable: boolean;
  marketable: boolean;
  commodity: boolean;
  market_fee_app?: string;
  market_tradable_restriction: number;
  market_marketable_restriction: number;
  descriptions: Description[];
  owner_actions?: Action[];
  tags: Tag[];
  id: string;
  fraudwarnings: unknown[];
  owner_descriptions?: Description[];
  actions: Action[];
  market_actions?: Action[];
}

export type Inventory = Item[];

export const INVENTORIES_BASE_URL = '/inventories';
export const INVENTORY_PATH = '/:steamid/:appid/:contextid';

import CEconItem from 'steamcommunity/classes/CEconItem';

export type Item = CEconItem;

export type Inventory = Item[];

export const INVENTORIES_BASE_URL = '/inventories';
export const INVENTORIES_GET_INVENTORY = '/:steamid/:appid/:contextid';

import CEconItem from 'steamcommunity/classes/CEconItem';

export type Item = CEconItem;

export type Inventory = Item[];

export const inventoriesBaseUrl = '/inventories';
export const getInventoryPath = '/:steamid/:appid/:contextid';

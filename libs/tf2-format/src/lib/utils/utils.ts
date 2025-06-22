import { InventoryItem, Item, PossibleInventoryItem } from '../types';

export const DEFAULT_ITEM = {
  assetid: null,
  defindex: -1,
  quality: -1,
  craftable: true,
  tradable: true,
  australium: false,
  festivized: false,
  effect: null,
  wear: null,
  paintkit: null,
  killstreak: 0,
  target: null,
  output: null,
  outputQuality: null,
  elevated: false,
  crateSeries: null,
  paint: null,
  parts: [],
  spells: [],
  sheen: null,
  killstreaker: null,
  inputs: null,
  quantity: 1,
} as const satisfies PossibleInventoryItem;

export const ITEM_FIELD_ID = {
  assetid: 0,
  defindex: 1,
  quality: 2,
  craftable: 3,
  tradable: 4,
  australium: 5,
  festivized: 6,
  effect: 7,
  wear: 8,
  paintkit: 9,
  killstreak: 10,
  target: 11,
  output: 12,
  outputQuality: 13,
  elevated: 14,
  crateSeries: 15,
  paint: 16,
  parts: 17,
  spells: 18,
  sheen: 19,
  killstreaker: 20,
  inputs: 21,
  quantity: 22,
} as const satisfies Record<keyof PossibleInventoryItem, number>;

export const ITEM_KEYS = Object.entries(ITEM_FIELD_ID)
  .sort(([, a], [, b]) => a - b)
  .map(([key]) => key) as ReadonlyArray<keyof PossibleInventoryItem>;

type Items = PossibleInventoryItem | InventoryItem | Item;

export class Utils {
  static getDefault(): PossibleInventoryItem {
    return {
      assetid: null,
      defindex: -1,
      quality: -1,
      craftable: true,
      tradable: true,
      australium: false,
      festivized: false,
      effect: null,
      wear: null,
      paintkit: null,
      killstreak: 0,
      target: null,
      output: null,
      outputQuality: null,
      elevated: false,
      crateSeries: null,
      paint: null,
      parts: [],
      spells: [],
      sheen: null,
      killstreaker: null,
      inputs: null,
      quantity: 1,
    };
  }

  static canonicalize<T extends Items>(item: Partial<T>): void {
    const quality = item.quality;

    if (quality === 5 || quality === 11 || quality === 15) {
      const isUnusual = quality === 5 || item.effect;
      const isStrange = quality === 11 || item.elevated;
      const isSkin = quality === 15 || item.paintkit || item.wear;

      let count = 0;

      if (isUnusual) count++;
      if (isStrange) count++;
      if (isSkin) count++;

      if (count > 1) {
        item.quality = -1;
        if (isStrange) {
          item.elevated = true;
        }
      }
    }
  }

  static normalize<T extends Items>(item: Partial<T>): void {
    for (const key of ITEM_KEYS) {
      if (item[key] === undefined) {
        item[key] = DEFAULT_ITEM[key];
      }
    }
  }

  static compact<T extends Items>(item: Partial<T>): void {
    for (const key of ITEM_KEYS) {
      if (
        item[key] === DEFAULT_ITEM[key] ||
        (Array.isArray(item[key]) && item[key].length === 0)
      ) {
        delete item[key];
      }
    }
  }
}

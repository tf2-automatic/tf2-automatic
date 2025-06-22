import { PossibleInventoryItem, RecipeInput } from '../types';
import { encode, decode } from 'cbor';
import { DEFAULT_ITEM, ITEM_FIELD_ID, Utils } from '../utils';

const ITEM_ID_FIELD = Object.fromEntries(
  Object.entries(ITEM_FIELD_ID).map(([k, v]) => [v, k]),
) as Record<number, keyof typeof ITEM_FIELD_ID>;

// This ensures keys are sorted in the bytewise lexicographic order
const ITEM_FIELDS_SORTED = Object.keys(DEFAULT_ITEM).sort((a, b) =>
  encode(ITEM_FIELD_ID[a]) > encode(ITEM_FIELD_ID[b]) ? 1 : -1,
) as ReadonlyArray<keyof PossibleInventoryItem>;

export type ItemMap = Map<number, unknown>;

export class Binary {
  static encode(item: Partial<PossibleInventoryItem>): Uint8Array {
    const copy: Partial<PossibleInventoryItem> = { ...item };

    Utils.compact(copy);
    Utils.canonicalize(copy);

    return encode(this.toIdMap(copy));
  }

  static decode(encoded: Uint8Array): Partial<PossibleInventoryItem> {
    // If we don't do `preferMap: true` then it would return an object for empty
    // maps.
    return this.fromIdMap(decode(encoded, { preferMap: true }));
  }

  private static toIdMap(item: Partial<PossibleInventoryItem>): ItemMap {
    // We have to use a map because the order of the keys matters
    const result = new Map<number, unknown>();

    for (const key of ITEM_FIELDS_SORTED) {
      const value = item[key];

      if (value !== undefined) {
        if (Array.isArray(value)) {
          const array = value.map((v) =>
            key === 'inputs' ? this.toIdMap(v) : v,
          );
          array.sort((a, b) => (encode(a) > encode(b) ? 1 : -1));

          if (array.length > 0) {
            result.set(ITEM_FIELD_ID[key], array);
          }
        } else {
          result.set(ITEM_FIELD_ID[key], value);
        }
      }
    }

    return result;
  }

  private static fromIdMap(item: ItemMap): Partial<PossibleInventoryItem> {
    const result: Partial<PossibleInventoryItem> = {};
    for (const [id, value] of item) {
      const key = ITEM_ID_FIELD[id];
      if (key === 'inputs' && Array.isArray(value)) {
        result.inputs = value.map((v) => this.fromIdMap(v) as RecipeInput);
      } else {
        result[key] = value as never;
      }
    }
    return result;
  }
}

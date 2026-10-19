import { PossibleInventoryItem, RecipeInput } from '../types';
import { Encoder } from 'cbor-x';
import { DEFAULT_ITEM, ITEM_FIELD_ID } from '../utils';

// Plain maps without records or tags, and decode all maps as Map objects
const encoder = new Encoder({ useRecords: false, mapsAsObjects: false });

const ITEM_ID_FIELD = Object.fromEntries(
  Object.entries(ITEM_FIELD_ID).map(([k, v]) => [v, k]),
) as Record<number, keyof typeof ITEM_FIELD_ID>;

// This ensures keys are sorted in the bytewise lexicographic order
const ITEM_FIELDS_SORTED = Object.keys(DEFAULT_ITEM).sort((a, b) =>
  encoder.encode(ITEM_FIELD_ID[a]) > encoder.encode(ITEM_FIELD_ID[b]) ? 1 : -1,
) as ReadonlyArray<keyof PossibleInventoryItem>;

// Local copy, imports compile to getter calls which are slow in the hot loop
const DEFAULTS: Record<string, unknown> = DEFAULT_ITEM;

// Ids in the same order, so the hot loop avoids a lookup per field
const ITEM_FIELD_IDS_SORTED = ITEM_FIELDS_SORTED.map(
  (key) => ITEM_FIELD_ID[key],
);

export type ItemMap = Map<number, unknown>;

export class Binary {
  static encode(item: Partial<PossibleInventoryItem>): Uint8Array {
    return encoder.encode(this.toCanonicalIdMap(item));
  }

  static decode(encoded: Uint8Array): Partial<PossibleInventoryItem> {
    return this.fromIdMap(encoder.decode(encoded));
  }

  // Same as Utils.compact and Utils.canonicalize on a copy, without copying or deleting
  private static toCanonicalIdMap(
    item: Partial<PossibleInventoryItem>,
  ): ItemMap {
    let quality = item.quality === DEFAULTS.quality ? undefined : item.quality;
    let elevated =
      item.elevated === DEFAULTS.elevated ? undefined : item.elevated;

    if (item.paintkit || item.wear) {
      const isStrange = quality === 11 || elevated;

      let count = 1;
      if (item.effect) count++;
      if (isStrange) count++;

      if (count > 1) {
        quality = -1;
        if (isStrange) {
          elevated = true;
        }
      }
    }

    // We have to use a map because the order of the keys matters
    const result = new Map<number, unknown>();

    for (let i = 0; i < ITEM_FIELDS_SORTED.length; i++) {
      const key = ITEM_FIELDS_SORTED[i];
      let value: unknown;
      if (key === 'quality') {
        value = quality;
      } else if (key === 'elevated') {
        value = elevated;
      } else {
        value = item[key];
        if (value === DEFAULTS[key]) {
          continue;
        }
      }

      if (value === undefined) {
        continue;
      }

      if (Array.isArray(value)) {
        if (value.length === 0) {
          continue;
        }
        value = this.sortArray(key, value);
      }

      result.set(ITEM_FIELD_IDS_SORTED[i], value);
    }

    return result;
  }

  private static toIdMap(item: Partial<PossibleInventoryItem>): ItemMap {
    // We have to use a map because the order of the keys matters
    const result = new Map<number, unknown>();

    for (const key of ITEM_FIELDS_SORTED) {
      const value = item[key];

      if (value !== undefined) {
        if (Array.isArray(value)) {
          if (value.length > 0) {
            result.set(ITEM_FIELD_ID[key], this.sortArray(key, value));
          }
        } else {
          result.set(ITEM_FIELD_ID[key], value);
        }
      }
    }

    return result;
  }

  private static sortArray(key: string, value: unknown[]): unknown[] {
    return (
      value
        .map((v) =>
          key === 'inputs'
            ? this.toIdMap(v as Partial<PossibleInventoryItem>)
            : v,
        )
        // Encode each element once instead of on every comparison
        .map((v) => [encoder.encode(v), v] as const)
        .sort(([a], [b]) => Buffer.compare(a, b))
        .map(([, v]) => v)
    );
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

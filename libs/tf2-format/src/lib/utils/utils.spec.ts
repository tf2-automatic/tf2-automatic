import { Item, PossibleInventoryItem } from '../types';
import { ITEM_FIELD_ID, Utils } from './utils';

describe('Utils', () => {
  it('should have unique values in ITEM_FIELD_ID', () => {
    const fieldIdValues = Object.values(ITEM_FIELD_ID);
    const uniqueFieldIdValues = new Set(fieldIdValues);
    expect(fieldIdValues.length).toBe(uniqueFieldIdValues.size);
  });

  describe('#canonicalize', () => {
    it('should canonicalize items correctly', () => {
      const items: Partial<Item>[] = [
        {
          defindex: 15003,
          quality: 15,
          effect: 703,
          wear: 3,
          paintkit: 12,
          elevated: true,
        },
        {
          defindex: 15003,
          quality: 5,
          effect: 703,
          wear: 3,
          paintkit: 12,
          elevated: true,
        },
        {
          defindex: 15003,
          quality: 11,
          effect: 703,
          wear: 3,
          paintkit: 12,
        },
      ];

      for (const item of items) {
        Utils.canonicalize(item);
        expect(item.quality).toBe(-1);
        expect(item.elevated).toBe(true);
      }
    });
  });

  describe('#compact', () => {
    it('should remove default values', () => {
      const item: Partial<PossibleInventoryItem> = {
        assetid: null,
        defindex: 15003,
        quality: 15,
        craftable: true,
        tradable: true,
        australium: false,
        festivized: false,
        effect: 703,
        wear: 3,
        paintkit: 12,
        killstreak: 0,
        target: null,
        output: null,
        outputQuality: null,
        elevated: true,
        crateSeries: null,
        paint: null,
        parts: [],
        spells: [],
        sheen: null,
        killstreaker: null,
        inputs: null,
        quantity: 1,
      };

      Utils.compact(item);

      expect(item).toEqual({
        defindex: 15003,
        quality: 15,
        effect: 703,
        wear: 3,
        paintkit: 12,
        elevated: true,
      });
    });
  });

  describe('#normalize', () => {
    it('should add default values', () => {
      const item: Partial<PossibleInventoryItem> = {
        defindex: 15003,
        quality: 15,
        effect: 703,
        wear: 3,
        paintkit: 12,
      };

      Utils.normalize(item);

      expect(item).toEqual({
        assetid: null,
        defindex: 15003,
        quality: 15,
        craftable: true,
        tradable: true,
        australium: false,
        festivized: false,
        effect: 703,
        wear: 3,
        paintkit: 12,
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
      });
    });
  });
});

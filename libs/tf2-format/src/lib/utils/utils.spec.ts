import { Item, PossibleInventoryItem } from '../types';
import { ITEM_FIELD_ID, Utils } from './utils';

describe('Utils', () => {
  it('should have unique values in ITEM_FIELD_ID', () => {
    const fieldIdValues = Object.values(ITEM_FIELD_ID);
    const uniqueFieldIdValues = new Set(fieldIdValues);
    expect(fieldIdValues.length).toBe(uniqueFieldIdValues.size);
  });

  describe('#canonicalize', () => {
    it('should canonicalize skins', () => {
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

    it('should handle strange unusual hhhh', () => {
      const item: Partial<Item> = {
        defindex: 266,
        quality: 5,
        elevated: true,
      };

      Utils.canonicalize(item);
      expect(item.quality).toBe(5);
      expect(item.elevated).toBe(true);
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

  describe('#hasAttribute', () => {
    it('will return true if the attribute is present and different', () => {
      const item = { ...Utils.getDefault(), defindex: 1 };
      expect(Utils.hasAttribute(item, 'defindex')).toBe(true);
    });

    it('will return false if the attribute is present and the same', () => {
      const item = { ...Utils.getDefault() };
      expect(Utils.hasAttribute(item, 'defindex')).toBe(false);
    });

    it('will work with arrays', () => {
      const item = { ...Utils.getDefault(), parts: [1] };
      expect(Utils.hasAttribute(item, 'parts')).toBe(true);
      expect(Utils.hasAttribute(item, 'spells')).toBe(false);
    });

    it('will work with booleans', () => {
      const item = { ...Utils.getDefault(), elevated: true };
      // Elevated is true and therefore different from the default
      expect(Utils.hasAttribute(item, 'elevated')).toBe(true);
      // Craftable is true, but it is not different from the default
      expect(Utils.hasAttribute(item, 'craftable')).toBe(false);
    });
  });
});

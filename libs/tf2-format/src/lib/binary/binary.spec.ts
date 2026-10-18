import { Binary } from './binary';
import { InventoryItem, Item } from '../types';

describe('Binary', () => {
  describe('#encode', () => {
    it('should decode an "empty" item', () => {
      const item: Partial<Item> = {};

      const encoded = Binary.encode(item);

      expect(encoded).toEqual(new Uint8Array([160]));
    });

    it('should encode an item with minimal properties', () => {
      const item: Partial<Item> = {
        defindex: 5021,
        quality: 6,
      };

      const encoded = Binary.encode(item);

      expect(encoded).toEqual(new Uint8Array([162, 1, 25, 19, 157, 2, 6]));
    });

    it('should encode inputs', () => {
      const item: Partial<Item> = {
        inputs: [
          {
            quantity: 10,
            quality: 6,
          },
          {
            quantity: 11,
            quality: 6,
          },
          { quality: 6, quantity: 12, killstreak: 1 },
          { quality: 6, quantity: 13, killstreak: 2, defindex: 123 },
        ],
      };

      const encoded = Binary.encode(item);

      expect(encoded).toEqual(
        new Uint8Array([
          161, 21, 132, 162, 2, 6, 22, 10, 162, 2, 6, 22, 11, 163, 2, 6, 10, 1,
          22, 12, 164, 1, 24, 123, 2, 6, 10, 2, 22, 13,
        ]),
      );
    });

    it('should encode parts', () => {
      const item: Partial<Item> = {
        parts: [3, 2, 1, 10, 20],
      };

      const encoded = Binary.encode(item);

      expect(encoded).toEqual(new Uint8Array([161, 17, 133, 1, 2, 3, 10, 20]));
    });

    it('should encode an item with all properties to the same bytes', () => {
      const item: Partial<InventoryItem> = {
        assetid: '15243278945',
        defindex: 30743,
        quality: 5,
        craftable: false,
        tradable: false,
        australium: true,
        festivized: true,
        effect: 3017,
        wear: 2,
        paintkit: 391,
        killstreak: 3,
        target: 1071,
        output: 6526,
        outputQuality: 6,
        elevated: true,
        crateSeries: 101,
        paint: 15185211,
        parts: [64, 17],
        spells: [
          [1009, 1],
          [1004, 2],
        ],
        sheen: 4,
        killstreaker: 2008,
        quantity: -1,
      };

      const encoded = Binary.encode(item);

      // Encoded items are used as keys, so the bytes must never change
      expect(encoded).toEqual(
        new Uint8Array([
          182, 0, 107, 49, 53, 50, 52, 51, 50, 55, 56, 57, 52, 53, 1, 25, 120,
          23, 2, 32, 3, 244, 4, 244, 5, 245, 6, 245, 7, 25, 11, 201, 8, 2, 9,
          25, 1, 135, 10, 3, 11, 25, 4, 47, 12, 25, 25, 126, 13, 6, 14, 245, 15,
          24, 101, 16, 26, 0, 231, 181, 59, 17, 130, 17, 24, 64, 18, 130, 130,
          25, 3, 236, 2, 130, 25, 3, 241, 1, 19, 4, 20, 25, 7, 216, 22, 32,
        ]),
      );
    });

    it('should sort parts that differ in bytes above 0x7f', () => {
      const expected = new Uint8Array([161, 17, 130, 25, 23, 128, 25, 23, 129]);

      expect(Binary.encode({ parts: [6016, 6017] })).toEqual(expected);
      expect(Binary.encode({ parts: [6017, 6016] })).toEqual(expected);
    });

    it('should not include empty parts, spells and inputs', () => {
      const item: Partial<Item> = {
        parts: [],
        spells: [],
        inputs: [],
      };

      const encoded = Binary.encode(item);

      expect(encoded).toEqual(new Uint8Array([160]));
    });

    it('should handle ambiguities', () => {
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
        const encoded = Binary.encode(item);

        expect(encoded).toEqual(
          new Uint8Array([
            166, 1, 25, 58, 155, 2, 32, 7, 25, 2, 191, 8, 3, 9, 12, 14, 245,
          ]),
        );
      }
    });

    it('will result in the same binary', () => {
      const items: Partial<Item>[] = [
        {
          defindex: 5021,
          quality: 6,
          craftable: true,
        },
        {
          defindex: 5021,
          quality: 6,
        },
        {
          craftable: true,
          defindex: 5021,
          quality: 6,
        },
        {
          craftable: true,
          defindex: 5021,
          quality: 6,
        },
        {
          defindex: 5021,
          quality: 6,
          // @ts-expect-error Type mismatch
          foo: 'bar',
        },
      ];

      for (const item of items) {
        const encoded = Binary.encode(item);

        expect(encoded).toEqual(new Uint8Array([162, 1, 25, 19, 157, 2, 6]));
      }
    });
  });

  describe('#decode', () => {
    it('should decode an "empty" item', () => {
      const item: Partial<Item> = {};

      const encoded = Binary.encode(item);

      const decoded = Binary.decode(encoded);

      expect(decoded).toEqual(item);
    });

    it('should decode inputs', () => {
      const item: Partial<Item> = {
        inputs: [
          { quality: 6, quantity: 10 },
          { quality: 6, quantity: 11 },
          { quality: 6, quantity: 12, killstreak: 1 },
        ],
      };

      const encoded = Binary.encode(item);

      const decoded = Binary.decode(encoded);

      expect(decoded).toEqual({
        inputs: [
          {
            quality: 6,
            quantity: 10,
          },
          {
            quality: 6,
            quantity: 11,
          },
          {
            killstreak: 1,
            quality: 6,
            quantity: 12,
          },
        ],
      });
    });
  });
});

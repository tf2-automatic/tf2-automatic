import { Binary } from './binary';
import { Item } from '../types';

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
          161, 21, 132, 164, 1, 24, 123, 2, 6, 10, 2, 22, 13, 163, 2, 6, 10, 1,
          22, 12, 162, 2, 6, 22, 10, 162, 2, 6, 22, 11,
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
            killstreak: 1,
            quality: 6,
            quantity: 12,
          },
          {
            quality: 6,
            quantity: 10,
          },
          {
            quality: 6,
            quantity: 11,
          },
        ],
      });
    });
  });
});

import { SKU } from './';
import * as TestData from './test-data';

describe('SKU', () => {
  describe('#fromItem', () => {
    it('will return a SKU string from an item', () => {
      const item = TestData.getBasicItem();

      const sku = SKU.fromObject(item);

      expect(sku).toEqual('5021;6');
    });

    it('will generate australium and killstreak', () => {
      const item = TestData.getAustraliumItem();

      const sku = SKU.fromObject(item);

      expect(sku).toEqual('211;11;australium;kt-3');
    });
  });

  describe('#fromString', () => {
    it('will return an item from a SKU string', () => {
      const sku = TestData.getBasicSKU();

      const item = SKU.fromString(sku);

      expect(item.defindex).toEqual(5021);
      expect(item.quality).toEqual(6);
    });

    it('will parse australium and killstreak', () => {
      const sku = TestData.getAustraliumSKU();

      const item = SKU.fromString(sku);

      expect(item.defindex).toEqual(211);
      expect(item.quality).toEqual(11);
      expect(item.australium).toEqual(true);
      expect(item.killstreak).toEqual(3);
    });

    it('will not throw', () => {
      expect(() => {
        SKU.fromString(`Pe]XD'h(k2lU~{wtVp//CE&;?fz'R@N3}FAQv~D;JOn&B]"Ay$`);
      }).not.toThrow();
    });
  });

  it('will result in the starting object', () => {
    const item = {
      defindex: 1,
      quality: 1,
      craftable: false,
      tradable: false,
      australium: true,
      killstreak: 1,
      effect: 1,
      festivized: true,
      paintkit: 1,
      wear: 1,
      elevated: true,
      crateSeries: 1,
      target: 1,
      output: 1,
      outputQuality: 1,
    };

    const sku = SKU.fromObject(item);

    expect(SKU.fromString(sku)).toEqual(item);
  });
});

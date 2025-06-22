import { RequiredItemAttributes } from '../types';
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

    it('will generate prof ks big kill', () => {
      const item = TestData.getProfessionalBigKillItem();

      const sku = SKU.fromObject(item);

      expect(sku).toEqual('161;6;kt-3;ks-1;ke-2005');
    });

    it('will generate painted unusual', () => {
      const item = TestData.getPaintedUnusualItem();

      const sku = SKU.fromObject(item);

      expect(sku).toEqual('378;5;u13;p16738740');
    });

    it('will generate red rock roscoe pistol', () => {
      const item = TestData.getRedRockRoscoePistolItem();

      const sku = SKU.fromObject(item);
      expect(sku).toEqual('15013;15;w1;pk0');
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

    it('will parse prof ks big kill', () => {
      const sku = TestData.getProfessionalBigKillSKU();

      const item = SKU.fromString(sku);

      expect(item.defindex).toEqual(161);
      expect(item.quality).toEqual(6);
      expect(item.killstreak).toEqual(3);
      expect(item.sheen).toEqual(1);
      expect(item.killstreaker).toEqual(2005);
    });

    it('will parse painted unusual', () => {
      const sku = TestData.getPaintedUnusualSKU();

      const item = SKU.fromString(sku);

      expect(item.defindex).toEqual(378);
      expect(item.quality).toEqual(5);
      expect(item.effect).toEqual(13);
      expect(item.paint).toEqual(16738740);
    });

    it('will decode -1', () => {
      const sku = '-1;-1';

      const item = SKU.fromString(sku);

      expect(item.defindex).toEqual(-1);
      expect(item.quality).toEqual(-1);
    });

    it('will decode -1234', () => {
      const sku = '-1234;-1234';

      const item = SKU.fromString(sku);

      expect(item.defindex).toEqual(-1234);
      expect(item.quality).toEqual(-1234);
    });

    it('will not throw', () => {
      expect(() => {
        SKU.fromString(`Pe]XD'h(k2lU~{wtVp//CE&;?fz'R@N3}FAQv~D;JOn&B]"Ay$`);
      }).not.toThrow();
    });
  });

  it('will preserve the "required" attributes', () => {
    const item: RequiredItemAttributes = {
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
      paint: 1,
      sheen: 1,
      killstreaker: 1,
      target: 1,
      output: 1,
      outputQuality: 1,
    };

    const sku = SKU.fromObject(item);

    expect(SKU.fromString(sku)).toEqual(item);
  });

  it('will not preserve parts, spells and inputs', () => {
    const item: RequiredItemAttributes = {
      defindex: 1,
      quality: 1,
      parts: [1, 2, 3],
      spells: [
        [1, 1],
        [2, 2],
      ],
      inputs: [{ quality: 1, quantity: 1 }],
    };

    const sku = SKU.fromObject(item);

    const parsed = SKU.fromString(sku);

    expect(parsed.defindex).toEqual(item.defindex);
    expect(parsed.quality).toEqual(item.quality);
    expect(parsed.parts).toBeUndefined();
    expect(parsed.spells).toBeUndefined();
    expect(parsed.inputs).toBeUndefined();
  });
});

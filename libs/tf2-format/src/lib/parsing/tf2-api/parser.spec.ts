import { TF2ParserSchema } from '../../schemas';
import { TF2APIParser } from './parser';
import * as TestData from './test-data';

describe('TF2APIParser', () => {
  describe('#extract', () => {
    let parser: TF2APIParser;

    beforeEach(() => {
      const schema: TF2ParserSchema = {
        getItemsGameItemByDefindex: jest.fn(),
        fetchItemsGameItemByDefindex: jest.fn(),
        getPaintByColor: jest.fn(),
        fetchPaintByColor: jest.fn(),
        getStrangePartById: jest.fn(),
        fetchStrangePartById: jest.fn(),
      };

      parser = new TF2APIParser(schema);
    });

    it('will parse basic attributes', () => {
      const item = TestData.getBasicItem();

      const extracted = parser.extract(item);

      expect(extracted.assetid).toEqual('15681438682');
      expect(extracted.originalId).toEqual('11373475188');
      expect(extracted.defindex).toEqual(5021);
      expect(extracted.quality).toEqual(6);
      expect(extracted.quantity).toEqual(1);
      expect(extracted.level).toEqual(5);
    });

    it('will parse professional killstreak items', () => {
      const item = TestData.getProfessionalKillstreakItem();

      const extracted = parser.extract(item);

      expect(extracted.assetid).toEqual('15497962225');
      expect(extracted.defindex).toEqual(154);
      expect(extracted.quality).toEqual(11);
      expect(extracted.killstreak).toEqual(3);
      expect(extracted.sheen).toEqual(6);
      expect(extracted.killstreaker).toEqual(2003);
    });

    it('will parse killstreak fabricators', () => {
      const item = TestData.getProfessionalKillstreakKitFabricator();

      const extracted = parser.extract(item);

      expect(extracted.assetid).toEqual('15443117973');
      expect(extracted.defindex).toEqual(20003);
      expect(extracted.quality).toEqual(6);
      expect(extracted.inputs).toEqual([
        { quality: 6, quantity: 2, killstreak: 2 },
        { quality: 6, quantity: 13, defindex: 5706 },
        { quality: 6, quantity: 3, defindex: 5707 },
        { quality: 6, quantity: 4, defindex: 5702 },
        { quality: 6, quantity: 2, defindex: 5704 },
        { quality: 6, quantity: 3, defindex: 5701 },
      ]);
      expect(extracted.killstreak).toEqual(3);
      expect(extracted.sheen).toEqual(7);
      expect(extracted.killstreaker).toEqual(2004);
      expect(extracted.output).toEqual(6526);
      expect(extracted.target).toEqual(406);
    });

    it('will parse strangifier chemistry sets', () => {
      const item = TestData.getStrangifierChemistrySet();

      const extracted = parser.extract(item);

      expect(extracted.assetid).toEqual('15510439400');
      expect(extracted.defindex).toEqual(20005);
      expect(extracted.quality).toEqual(6);
      expect(extracted.inputs).toEqual([
        {
          quantity: 4,
          defindex: 331,
          quality: 6,
        },
        {
          quantity: 1,
          defindex: 61,
          quality: 6,
        },
        {
          quantity: 1,
          defindex: 649,
          quality: 6,
        },
        {
          quantity: 1,
          defindex: 42,
          quality: 6,
        },
        {
          quantity: 1,
          defindex: 36,
          quality: 6,
        },
        {
          quantity: 1,
          defindex: 38,
          quality: 6,
        },
        {
          quantity: 1,
          defindex: 43,
          quality: 11,
        },
      ]);
      expect(extracted.output).toEqual(6522);
    });

    it('will parse dueling minigames', () => {
      const item = TestData.getDuelingMinigame();

      const extracted = parser.extract(item);

      expect(extracted.assetid).toEqual('15568852549');
      expect(extracted.defindex).toEqual(241);
      expect(extracted.quality).toEqual(6);
      expect(extracted.quantity).toEqual(5);
    });

    it('will parse spelled items', () => {
      const item = TestData.getSpelledItem();

      const extracted = parser.extract(item);

      expect(extracted.assetid).toEqual('7453028434');
      expect(extracted.defindex).toEqual(44);
      expect(extracted.quality).toEqual(11);
      expect(extracted.killstreak).toEqual(1);
      expect(extracted.spells).toEqual([[1009, 1]]);
    });

    it('will parse killstreak, strange parts and spells', () => {
      const item = TestData.getProfessionalKillstreakItemWithSpellAndParts();

      const extracted = parser.extract(item);

      expect(extracted.assetid).toEqual('15795067590');
      expect(extracted.defindex).toEqual(191);
      expect(extracted.quality).toEqual(11);
      expect(extracted.killstreak).toEqual(3);
      expect(extracted.sheen).toEqual(1);
      expect(extracted.killstreaker).toEqual(2005);
      expect(extracted.spells).toEqual([[1009, 1]]);
      expect(extracted.parts).toEqual([33, 15]);
    });

    it('will parse elevated unusual skin', () => {
      const item = TestData.getElevatedUnusualSkin();

      const extracted = parser.extract(item);

      expect(extracted.assetid).toEqual('15544141666');
      expect(extracted.defindex).toEqual(15052);
      expect(extracted.quality).toEqual(15);
      expect(extracted.elevated).toEqual(true);
      expect(extracted.wear).toEqual(1);
      expect(extracted.paintkit).toEqual(52);
      expect(extracted.killstreak).toEqual(3);
      expect(extracted.sheen).toEqual(4);
      expect(extracted.killstreaker).toEqual(2002);
      expect(extracted.spells).toEqual([
        [1007, 1],
        [1009, 1],
      ]);
      expect(extracted.parts).toEqual([82, 23, 34]);
    });

    it('will parse professional killstreak kit', () => {
      const item = TestData.getProfessionalKillstreakKit();

      const extracted = parser.extract(item);

      expect(extracted.assetid).toEqual('15080836060');
      expect(extracted.defindex).toEqual(6526);
      expect(extracted.quality).toEqual(6);
      expect(extracted.craftable).toEqual(false);
      expect(extracted.killstreak).toEqual(3);
      expect(extracted.sheen).toEqual(1);
      expect(extracted.killstreaker).toEqual(2002);
      expect(extracted.target).toEqual(128);
    });
  });
});

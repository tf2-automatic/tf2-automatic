import { EconParser } from './parser';
import { EconItem, Tag } from './types';
import * as TestData from './test-data';
import { Schema } from '../types';

describe('EconParser', () => {
  describe('#getDefindex', () => {
    it('will return the defindex', () => {
      const item = {
        actions: [
          {
            link: 'http://wiki.teamfortress.com/scripts/itemredirect.php?id=5021&lang=en_US',
            name: 'Item Wiki Page...',
          },
        ],
      } satisfies Partial<EconItem> as EconItem;

      const defindex = EconParser.getDefindex(item);

      expect(defindex).toBe(5021);
    });

    it('will return null if the defindex is not found', () => {
      const item = {
        actions: [
          {
            link: 'http://wiki.teamfortress.com/scripts/itemredirect.php?lang=en_US',
            name: 'Item Wiki Page...',
          },
        ],
      } satisfies Partial<EconItem> as EconItem;

      const defindex = EconParser.getDefindex(item);

      expect(defindex).toBeNull();
    });
  });

  describe('#getTagAttributes', () => {
    it('will return the attributes', () => {
      const item = {
        tags: [
          {
            internal_name: 'Unique',
            name: 'Unique',
            category: 'Quality',
            color: '7D6D00',
            category_name: 'Quality',
          },
          {
            internal_name: 'Factory New',
            name: 'Factory New',
            category: 'Exterior',
            color: '4B69FF',
            category_name: 'Exterior',
          },
        ],
      } satisfies Partial<EconItem> as EconItem;

      const attributes = EconParser.getTagAttributes(item);

      expect(attributes.Quality).toBe('Unique');
      expect(attributes.Exterior).toBe('Factory New');
    });

    it('will return undefined if the attributes are not found', () => {
      const tags: Tag[] = [];

      const item = {
        tags,
      } satisfies Partial<EconItem> as EconItem;

      const attributes = EconParser.getTagAttributes(item);

      expect(attributes.Quality).toBeUndefined();
      expect(attributes.Exterior).toBeUndefined();
    });
  });

  describe('#getDescriptionAttributes', () => {
    it('will return the attributes', () => {
      const item = {
        descriptions: [
          {
            value: 'Paint Color: A Deep Commitment to Purple',
          },
          {
            value: 'Halloween: Exorcism (spell only active during event)',
          },
          {
            value: '     Kills: 0',
          },
          {
            value: '(Assists: 0)',
          },
          {
            value: '★ Unusual Effect: Isotope',
          },
          {
            value: 'Festivized',
          },
          {
            value: 'Killstreaker: Fire Horns',
          },
          {
            value: 'Sheen: Agonizing Emerald',
          },
          {
            value: 'Killstreaks Active',
          },
          {
            value: '( Not Usable in Crafting )',
          },
        ],
      } satisfies Partial<EconItem> as EconItem;

      const attributes = EconParser.getDescriptionAttributes(item, {});

      expect(attributes.killstreak).toBe(true);
      expect(attributes.sheen).toBe('Agonizing Emerald');
      expect(attributes.killstreaker).toBe('Fire Horns');
      expect(attributes.paint).toBe('A Deep Commitment to Purple');
      expect(attributes.festivized).toBe(true);
      expect(attributes.craftable).toBe(false);
      expect(attributes.effect).toBe('Isotope');
      expect(attributes.parts).toEqual(['Kills', 'Assists']);
      expect(attributes.spells).toEqual(['Exorcism']);
    });

    it('will only parse the first instance of a description', () => {
      const item = {
        descriptions: [
          {
            value: 'Killstreaker: Fire Horns',
          },
          {
            value: 'Killstreaker: Tornado',
          },
        ],
      } satisfies Partial<EconItem> as EconItem;

      const attributes = EconParser.getDescriptionAttributes(item, {});

      expect(attributes.killstreaker).toBe('Fire Horns');
    });
  });

  describe('#extract', () => {
    let parser: EconParser;

    beforeEach(() => {
      const schema: Schema = {
        getDefindexByName: jest.fn(),
        fetchDefindexByName: jest.fn(),
        getQualityByName: jest.fn(),
        fetchQualityByName: jest.fn(),
        getEffectByName: jest.fn(),
        fetchEffectByName: jest.fn(),
        getSpellByName: jest.fn(),
        fetchSpellByName: jest.fn(),
        getTextureByName: jest.fn(),
        fetchTextureByName: jest.fn(),
      };

      parser = new EconParser(schema);
    });

    it('will parse basic attributes', () => {
      const item = TestData.getBasicItem();

      const extracted = parser.extract(item);

      expect(extracted.assetid).toEqual('13658582638');
      expect(extracted.defindex).toEqual(5021);
      expect(extracted.quality).toEqual('Unique');
      expect(extracted.craftable).toEqual(true);
      expect(extracted.tradable).toEqual(true);
    });

    it('will parse Strangifier Chemistry Sets', () => {
      const item = TestData.getStrangifierChemistrySet();
      const extractd = parser.extract(item);

      expect(extractd.input).toEqual([
        {
          name: 'The Righteous Bison',
          amount: 5,
        },
        {
          name: 'The Winger',
          amount: 1,
        },
        {
          name: 'The Backburner',
          amount: 1,
        },
        {
          name: 'The Gunboats',
          amount: 1,
        },
        {
          name: 'The Half-Zatoichi',
          amount: 1,
        },
        {
          name: 'Strange Mad Milk',
          amount: 1,
        },
      ]);

      expect(extractd.quality).toEqual('Unique');
      expect(extractd.output).toEqual('Professor Speks');
      expect(extractd.outputQuality).toEqual('Strange');
      expect(extractd.target).toEqual(null);
      expect(extractd.uses).toEqual(1);
    });

    it('will parse Strangifiers', () => {
      const item = TestData.getStrangifier();

      const extractd = parser.extract(item);

      expect(extractd.quality).toEqual('Unique');
      expect(extractd.target).toEqual("Cleaner's Carbine");
      expect(extractd.output).toEqual(null);
    });

    it("will parse Collector's Chemistry Sets", () => {
      const item = TestData.getCollectorsChemistrySet();

      const extractd = parser.extract(item);

      expect(extractd.output).toEqual('Sharpened Volcano Fragment');
      expect(extractd.outputQuality).toEqual("Collector's");
      expect(extractd.target).toEqual(null);
      expect(extractd.input).toEqual([
        {
          name: 'Sharpened Volcano Fragment',
          amount: 1,
        },
      ]);
    });

    it('will parse Unusualifiers', () => {
      const item = TestData.getUnusualifier();

      const extractd = parser.extract(item);

      expect(extractd.target).toEqual('Taunt: Spin-to-Win');
      expect(extractd.output).toEqual(null);
    });

    it('will parse Professional Killstreak Kit Fabricators', () => {
      const item = TestData.getKillstreakKitFabricator();

      const extractd = parser.extract(item);

      expect(extractd.output).toEqual('Kit');
      expect(extractd.outputQuality).toEqual('Unique');
      expect(extractd.target).toEqual('Splendid Screen');
      expect(extractd.killstreaker).toEqual('Tornado');
      expect(extractd.sheen).toEqual('Hot Rod');
      expect(extractd.killstreak).toEqual(3);
    });

    it('will parse Professional Kilstreak Kits', () => {
      const item = TestData.getKillstreakKit();

      const extractd = parser.extract(item);

      expect(extractd.killstreaker).toEqual('Hypno-Beam');
      expect(extractd.sheen).toEqual('Villainous Violet');
      expect(extractd.killstreak).toEqual(3);
      expect(extractd.target).toEqual("Hitman's Heatmaker");
    });

    it('will detect elevated qualities for haunted items', () => {
      const item = TestData.getHauntedElevatedQualityItem();

      const extractd = parser.extract(item);

      expect(extractd.quality).toEqual('Haunted');
      expect(extractd.elevated).toEqual(true);
      expect(extractd.parts).toEqual([
        'Carnival Underworld Kills',
        'Carnival Games Won',
      ]);
    });

    it('will detect elevated qualities for unusual items', () => {
      const item = TestData.getUnusualElevatedQualityItem();

      const extractd = parser.extract(item);

      expect(extractd.quality).toEqual('Unusual');
      expect(extractd.elevated).toEqual(true);
    });

    it('will parse decorated weapons', () => {
      const item = TestData.getDecoratedWeapon();

      const extractd = parser.extract(item);

      expect(extractd.wear).toEqual('Factory New');
      expect(extractd.paintkit).toEqual('Civil Servant Mk.II');
      expect(extractd.quality).toEqual('Decorated Weapon');
    });

    it('will parse War Paints', () => {
      const item = TestData.getWarPaint();

      const extractd = parser.extract(item);

      expect(extractd.wear).toEqual('Field-Tested');
      expect(extractd.paintkit).toEqual('Sweet Toothed');
      expect(extractd.quality).toEqual('Decorated Weapon');
    });

    it('will parse painted cosmetic items', () => {
      const item = TestData.getPaintedCosmetic();

      const extractd = parser.extract(item);

      expect(extractd.defindex).toEqual(30367);
      expect(extractd.quality).toEqual('Unique');
      expect(extractd.craftable).toEqual(true);
      expect(extractd.tradable).toEqual(true);
      expect(extractd.paint).toEqual('Team Spirit');
    });

    it('will parse dueling mini-games', () => {
      const item = TestData.getDuelingMiniGame();

      const extractd = parser.extract(item);

      expect(extractd.defindex).toEqual(241);
      expect(extractd.quality).toEqual('Unique');
      expect(extractd.craftable).toEqual(true);
      expect(extractd.tradable).toEqual(true);
      expect(extractd.uses).toEqual(5);
    });

    it('will parse giftapults', () => {
      const item = TestData.getGiftapult();

      const extractd = parser.extract(item);

      expect(extractd.defindex).toEqual(5083);
      expect(extractd.quality).toEqual('Unique');
      expect(extractd.craftable).toEqual(true);
      expect(extractd.tradable).toEqual(false);
      expect(extractd.uses).toEqual(1);
    });

    it('will parse strange parts', () => {
      const item = TestData.getStrangePart();

      const extractd = parser.extract(item);

      expect(extractd.defindex).toEqual(6012);
      expect(extractd.quality).toEqual('Unique');
      expect(extractd.craftable).toEqual(true);
      expect(extractd.tradable).toEqual(true);
    });

    it('will parse Australium Gold', () => {
      const item = TestData.getAustraliumGold();

      const extractd = parser.extract(item);

      expect(extractd.defindex).toEqual(5037);
      expect(extractd.quality).toEqual('Unique');
      expect(extractd.craftable).toEqual(true);
      expect(extractd.tradable).toEqual(true);
      expect(extractd.australium).toEqual(false);
    });

    it('will parse australium weapons', () => {
      const item = TestData.getAustraliumWeapon();

      const extractd = parser.extract(item);

      expect(extractd.defindex).toEqual(205);
      expect(extractd.quality).toEqual('Strange');
      expect(extractd.craftable).toEqual(true);
      expect(extractd.tradable).toEqual(true);
      expect(extractd.australium).toEqual(true);
    });

    it('will parse festivized items', () => {
      const item = TestData.getFestivizedItem();

      const extractd = parser.extract(item);

      expect(extractd.defindex).toEqual(200);
      expect(extractd.quality).toEqual('Strange');
      expect(extractd.craftable).toEqual(true);
      expect(extractd.tradable).toEqual(true);
      expect(extractd.festivized).toEqual(true);
    });

    it('will not parse effects from crates', () => {
      const item = TestData.getCrateWithEffects();

      const extractd = parser.extract(item);

      expect(extractd.effect).toBeNull();
    });

    it('will not parse texture when missing exterior tag', () => {
      const item = TestData.getCosmeticWithGrade();

      const extractd = parser.extract(item);

      expect(extractd.paintkit).toBeNull();
    });
  });
});

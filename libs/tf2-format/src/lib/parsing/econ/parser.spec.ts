import { EconParser } from './parser';
import { EconItem, Tag } from './types';
import * as TestData from './test-data';
import { EconParserSchema } from '../../types';

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
      const schema: EconParserSchema = {
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
        getStrangePartByScoreType: jest.fn(),
        fetchStrangePartByScoreType: jest.fn(),
        getItemByDefindex: jest.fn(),
        fetchItemByDefindex: jest.fn(),
        getSheenByName: jest.fn(),
        fetchSheenByName: jest.fn(),
        getKillstreakerByName: jest.fn(),
        fetchKillstreakerByName: jest.fn(),
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
      const extracted = parser.extract(item);

      expect(extracted.inputs).toEqual([
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

      expect(extracted.defindex).toEqual(20005);
      expect(extracted.quality).toEqual('Unique');
      expect(extracted.output).toEqual('Strangifier');
      expect(extracted.target).toEqual('Professor Speks');
      expect(extracted.uses).toEqual(1);
    });

    it('will parse Strangifiers', () => {
      const item = TestData.getStrangifier();

      const extracted = parser.extract(item);

      expect(extracted.quality).toEqual('Unique');
      expect(extracted.target).toEqual("Cleaner's Carbine");
      expect(extracted.output).toEqual(null);
    });

    it("will parse Collector's Chemistry Sets", () => {
      const item = TestData.getCollectorsChemistrySet();

      const extracted = parser.extract(item);

      expect(extracted.output).toEqual('Sharpened Volcano Fragment');
      expect(extracted.outputQuality).toEqual("Collector's");
      expect(extracted.target).toEqual(null);
      expect(extracted.inputs).toEqual([
        {
          name: 'Sharpened Volcano Fragment',
          amount: 1,
        },
      ]);
    });

    it('will parse Unusualifiers', () => {
      const item = TestData.getUnusualifier();

      const extracted = parser.extract(item);

      expect(extracted.target).toEqual('Taunt: Spin-to-Win');
      expect(extracted.output).toEqual(null);
    });

    it('will parse Professional Killstreak Kit Fabricators', () => {
      const item = TestData.getKillstreakKitFabricator();

      const extracted = parser.extract(item);

      expect(extracted.output).toEqual('Kit');
      expect(extracted.outputQuality).toEqual('Unique');
      expect(extracted.target).toEqual('Splendid Screen');
      expect(extracted.killstreaker).toEqual('Tornado');
      expect(extracted.sheen).toEqual('Hot Rod');
      expect(extracted.killstreak).toEqual(3);
      expect(extracted.inputs).toEqual([
        {
          name: 'Unique Specialized Killstreak Item',
          amount: 2,
        },
        {
          name: 'Battle-Worn Robot KB-808',
          amount: 13,
        },
        {
          name: 'Battle-Worn Robot Money Furnace',
          amount: 3,
        },
        {
          name: 'Reinforced Robot Emotion Detector',
          amount: 4,
        },
        {
          name: 'Reinforced Robot Bomb Stabilizer',
          amount: 2,
        },
        {
          name: 'Pristine Robot Brainstorm Bulb',
          amount: 3,
        },
      ]);
    });

    it('will parse Professional Kilstreak Kits', () => {
      const item = TestData.getKillstreakKit();

      const extracted = parser.extract(item);

      expect(extracted.killstreaker).toEqual('Hypno-Beam');
      expect(extracted.sheen).toEqual('Villainous Violet');
      expect(extracted.killstreak).toEqual(3);
      expect(extracted.target).toEqual("Hitman's Heatmaker");
    });

    it('will parse C.A.P.P.E.R Kilstreak Kits', () => {
      const item = TestData.getCAPPERKillstreakKit();

      const extracted = parser.extract(item);

      expect(extracted.killstreaker).toEqual(null);
      expect(extracted.sheen).toEqual(null);
      expect(extracted.killstreak).toEqual(1);
      expect(extracted.target).toEqual('C.A.P.P.E.R');
    });

    it('will detect elevated qualities for haunted items', () => {
      const item = TestData.getHauntedElevatedQualityItem();

      const extracted = parser.extract(item);

      expect(extracted.quality).toEqual('Haunted');
      expect(extracted.elevated).toEqual(true);
      expect(extracted.parts).toEqual([
        'Carnival Underworld Kills',
        'Carnival Games Won',
      ]);
    });

    it('will detect elevated qualities for unusual items', () => {
      const item = TestData.getUnusualElevatedQualityItem();

      const extracted = parser.extract(item);

      expect(extracted.quality).toEqual('Unusual');
      expect(extracted.elevated).toEqual(true);
      expect(extracted.parts).toEqual([
        'Kills Under A Full Moon',
        'Kills',
        'Damage Dealt',
      ]);
    });

    it('will parse decorated weapons', () => {
      const item = TestData.getDecoratedWeapon();

      const extracted = parser.extract(item);

      expect(extracted.wear).toEqual('Factory New');
      expect(extracted.paintkit).toEqual('Civil Servant Mk.II');
      expect(extracted.quality).toEqual('Decorated Weapon');
    });

    it('will parse War Paints', () => {
      const item = TestData.getWarPaint();

      const extracted = parser.extract(item);

      expect(extracted.wear).toEqual('Field-Tested');
      expect(extracted.paintkit).toEqual('Sweet Toothed');
      expect(extracted.quality).toEqual('Decorated Weapon');
    });

    it('will parse painted cosmetic items', () => {
      const item = TestData.getPaintedCosmetic();

      const extracted = parser.extract(item);

      expect(extracted.defindex).toEqual(30367);
      expect(extracted.quality).toEqual('Unique');
      expect(extracted.craftable).toEqual(true);
      expect(extracted.tradable).toEqual(true);
      expect(extracted.paint).toEqual('Team Spirit');
    });

    it('will parse dueling mini-games', () => {
      const item = TestData.getDuelingMiniGame();

      const extracted = parser.extract(item);

      expect(extracted.defindex).toEqual(241);
      expect(extracted.quality).toEqual('Unique');
      expect(extracted.craftable).toEqual(true);
      expect(extracted.tradable).toEqual(true);
      expect(extracted.uses).toEqual(5);
    });

    it('will parse giftapults', () => {
      const item = TestData.getGiftapult();

      const extracted = parser.extract(item);

      expect(extracted.defindex).toEqual(5083);
      expect(extracted.quality).toEqual('Unique');
      expect(extracted.craftable).toEqual(true);
      expect(extracted.tradable).toEqual(false);
      expect(extracted.uses).toEqual(1);
    });

    it('will parse strange parts', () => {
      const item = TestData.getStrangePart();

      const extracted = parser.extract(item);

      expect(extracted.defindex).toEqual(6012);
      expect(extracted.quality).toEqual('Unique');
      expect(extracted.craftable).toEqual(true);
      expect(extracted.tradable).toEqual(true);
    });

    it('will parse Australium Gold', () => {
      const item = TestData.getAustraliumGold();

      const extracted = parser.extract(item);

      expect(extracted.defindex).toEqual(5037);
      expect(extracted.quality).toEqual('Unique');
      expect(extracted.craftable).toEqual(true);
      expect(extracted.tradable).toEqual(true);
      expect(extracted.australium).toEqual(false);
    });

    it('will parse australium weapons', () => {
      const item = TestData.getAustraliumWeapon();

      const extracted = parser.extract(item);

      expect(extracted.defindex).toEqual(205);
      expect(extracted.quality).toEqual('Strange');
      expect(extracted.craftable).toEqual(true);
      expect(extracted.tradable).toEqual(true);
      expect(extracted.australium).toEqual(true);
    });

    it('will parse festivized items', () => {
      const item = TestData.getFestivizedItem();

      const extracted = parser.extract(item);

      expect(extracted.defindex).toEqual(200);
      expect(extracted.quality).toEqual('Strange');
      expect(extracted.craftable).toEqual(true);
      expect(extracted.tradable).toEqual(true);
      expect(extracted.festivized).toEqual(true);
    });

    it('will not parse effects from crates', () => {
      const item = TestData.getCrateWithEffects();

      const extracted = parser.extract(item);

      expect(extracted.effect).toBeNull();
    });

    it('will not parse texture when missing exterior tag', () => {
      const item = TestData.getCosmeticWithGrade();

      const extracted = parser.extract(item);

      expect(extracted.paintkit).toBeNull();
    });

    it('will parse unusual decorated weapons', () => {
      const item = TestData.getUnusualDecoratedWeapon();

      const extracted = parser.extract(item);

      expect(extracted.quality).toEqual('Decorated Weapon');
      expect(extracted.effect).toEqual('Cool');
      expect(extracted.paintkit).toEqual('Candy Coated');
      expect(extracted.wear).toEqual('Field-Tested');
      expect(extracted.festivized).toEqual(true);
      expect(extracted.killstreak).toEqual(3);
      expect(extracted.killstreaker).toEqual('Incinerator');
      expect(extracted.sheen).toEqual('Deadly Daffodil');
    });

    it('will parse unusual decorated war paints', () => {
      const item = TestData.getUnusualDecoratedWarPaint();

      const extracted = parser.extract(item);

      expect(extracted.quality).toEqual('Unusual');
      expect(extracted.effect).toEqual('Cool');
      expect(extracted.paintkit).toEqual('Death Deluxe');
      expect(extracted.wear).toEqual('Well-Worn');
    });

    it('will parse decorated weapons without an effect', () => {
      const item = TestData.getDecoratedWeaponWithoutEffect();

      const extracted = parser.extract(item);

      expect(extracted.quality).toEqual('Strange');
      expect(extracted.paintkit).toEqual('Flash Fryer');
      expect(extracted.wear).toEqual('Factory New');
      expect(extracted.effect).toEqual(null);
      expect(extracted.parts).toEqual([
        'Kills',
        'Teammates Extinguished',
        'Projectiles Reflected',
      ]);
    });

    it('will parse crate series', () => {
      const item = TestData.getCrateWithSeries();

      const extracted = parser.extract(item);

      expect(extracted.crateSeries).toEqual(57);
    });

    it('will parse strange war paint with effect', () => {
      const item = TestData.getStrangeWarPaintWithEffect();

      const extracted = parser.extract(item);

      expect(extracted.quality).toEqual('Strange');
      expect(extracted.effect).toEqual('Hot');
      expect(extracted.paintkit).toEqual('Frozen Aurora');
      expect(extracted.wear).toEqual('Minimal Wear');
    });

    it('will parse spelled unusuals', () => {
      const item = TestData.getSpelledUnusual();

      const extracted = parser.extract(item);

      expect(extracted.quality).toEqual('Unusual');
      expect(extracted.effect).toEqual('Green Energy');
      expect(extracted.spells).toEqual([
        'Gangreen Footprints',
        'Voices from Below',
      ]);
    });
  });

  describe('#parse', () => {
    let parser: EconParser;
    let schema: Record<keyof EconParserSchema, jest.Mock>;

    function mockSchema() {
      schema.getDefindexByName.mockReturnValue(undefined);
      schema.fetchDefindexByName.mockResolvedValue(-1);
      schema.getQualityByName.mockReturnValue(undefined);
      schema.fetchQualityByName.mockResolvedValue(-1);
      schema.getEffectByName.mockReturnValue(undefined);
      schema.fetchEffectByName.mockResolvedValue(-1);
      schema.getSpellByName.mockReturnValue(undefined);
      schema.fetchSpellByName.mockResolvedValue(-1);
      schema.getTextureByName.mockReturnValue(undefined);
      schema.fetchTextureByName.mockResolvedValue(-1);
      schema.getStrangePartByScoreType.mockReturnValue(undefined);
      schema.fetchStrangePartByScoreType.mockResolvedValue(-1);
      schema.getItemByDefindex.mockReturnValue(undefined);
      schema.fetchItemByDefindex.mockResolvedValue({
        name: 'Decoder Ring',
      });
      schema.getSheenByName.mockReturnValue(undefined);
      schema.fetchSheenByName.mockResolvedValue(-1);
      schema.getKillstreakerByName.mockReturnValue(undefined);
      schema.fetchKillstreakerByName.mockResolvedValue(-1);
    }

    beforeEach(() => {
      schema = {
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
        getStrangePartByScoreType: jest.fn(),
        fetchStrangePartByScoreType: jest.fn(),
        getItemByDefindex: jest.fn(),
        fetchItemByDefindex: jest.fn(),
        getSheenByName: jest.fn(),
        fetchSheenByName: jest.fn(),
        getKillstreakerByName: jest.fn(),
        fetchKillstreakerByName: jest.fn(),
      };

      parser = new EconParser(schema);
    });

    it('will only use `get` method if it returned data', async () => {
      schema.getQualityByName.mockReturnValue(6);

      const item = TestData.getBasicItem();

      const extracted = parser.extract(item);
      const parsed = await parser.parse(extracted);

      expect(schema.getQualityByName).toHaveBeenCalledTimes(1);
      expect(schema.getQualityByName).toHaveBeenNthCalledWith(1, 'Unique');

      expect(parsed.quality).toEqual(6);
    });

    it('will use `fetch` method if `get` returned no data', async () => {
      schema.getQualityByName.mockReturnValue(undefined);
      schema.fetchQualityByName.mockResolvedValue(6);

      const item = TestData.getBasicItem();

      const extracted = parser.extract(item);
      const parsed = await parser.parse(extracted);

      expect(schema.getQualityByName).toHaveBeenCalledTimes(1);
      expect(schema.getQualityByName).toHaveBeenNthCalledWith(1, 'Unique');

      expect(parsed.quality).toEqual(6);
    });

    it('will throw if `fetch` throws', async () => {
      schema.getQualityByName.mockReturnValue(undefined);
      schema.fetchQualityByName.mockRejectedValue(
        new Error('Failed to fetch quality'),
      );

      const item = TestData.getBasicItem();

      const extracted = parser.extract(item);
      const parse = parser.parse(extracted);

      await expect(parse).rejects.toThrow('Failed to fetch quality');
    });

    it('will properly handle non-cosmetic items with strange parts', async () => {
      const item = TestData.getDecoratedWeaponWithoutEffect();

      mockSchema();

      const extracted = parser.extract(item);
      const parsed = await parser.parse(extracted);

      expect(schema.fetchStrangePartByScoreType).toHaveBeenCalledTimes(3);
      expect(schema.fetchStrangePartByScoreType).toHaveBeenNthCalledWith(
        1,
        'Kills',
      );
      expect(schema.fetchStrangePartByScoreType).toHaveBeenNthCalledWith(
        2,
        'Teammates Extinguished',
      );
      expect(schema.fetchStrangePartByScoreType).toHaveBeenNthCalledWith(
        3,
        'Projectiles Reflected',
      );

      expect(parsed.parts).toEqual([-1, -1, -1]);
    });

    it('will properly handle cosmetic items with strange parts', async () => {
      const item = TestData.getUnusualElevatedQualityItem();

      mockSchema();

      const extracted = parser.extract(item);
      const parsed = await parser.parse(extracted);

      expect(schema.fetchStrangePartByScoreType).toHaveBeenCalledTimes(3);
      expect(schema.fetchStrangePartByScoreType).toHaveBeenNthCalledWith(
        1,
        'Kills Under A Full Moon',
      );
      expect(schema.fetchStrangePartByScoreType).toHaveBeenNthCalledWith(
        2,
        'Kills',
      );
      expect(schema.fetchStrangePartByScoreType).toHaveBeenNthCalledWith(
        3,
        'Damage Dealt',
      );

      expect(parsed.parts).toEqual([-1, -1, -1]);
    });

    it('will parse Killstreak Kit Fabricators', async () => {
      const item = TestData.getKillstreakKitFabricator();

      mockSchema();

      const extracted = parser.extract(item);
      const parsed = await parser.parse(extracted);

      expect(schema.fetchDefindexByName).toHaveBeenCalledTimes(6);
      expect(schema.fetchDefindexByName).toHaveBeenNthCalledWith(
        1,
        'Splendid Screen',
      );
      expect(schema.fetchDefindexByName).toHaveBeenNthCalledWith(
        2,
        'Battle-Worn Robot KB-808',
      );
      expect(schema.fetchDefindexByName).toHaveBeenNthCalledWith(
        3,
        'Battle-Worn Robot Money Furnace',
      );
      expect(schema.fetchDefindexByName).toHaveBeenNthCalledWith(
        4,
        'Reinforced Robot Emotion Detector',
      );
      expect(schema.fetchDefindexByName).toHaveBeenNthCalledWith(
        5,
        'Reinforced Robot Bomb Stabilizer',
      );
      expect(schema.fetchDefindexByName).toHaveBeenNthCalledWith(
        6,
        'Pristine Robot Brainstorm Bulb',
      );

      expect(parsed.inputs).toEqual([
        {
          killstreak: 2,
          quality: -1,
          amount: 2,
        },
        {
          defindex: -1,
          quality: -1,
          amount: 13,
        },
        {
          defindex: -1,
          quality: -1,
          amount: 3,
        },
        {
          defindex: -1,
          quality: -1,
          amount: 4,
        },
        {
          defindex: -1,
          quality: -1,
          amount: 2,
        },
        {
          defindex: -1,
          quality: -1,
          amount: 3,
        },
      ]);
    });

    it('will parse Strangifier Chemistry Sets', async () => {
      const item = TestData.getStrangifierChemistrySet();

      mockSchema();

      const extracted = parser.extract(item);
      const parsed = await parser.parse(extracted);

      expect(schema.fetchDefindexByName).toHaveBeenCalledTimes(7);
      expect(schema.fetchDefindexByName).toHaveBeenNthCalledWith(
        1,
        'Professor Speks',
      );
      expect(schema.fetchDefindexByName).toHaveBeenNthCalledWith(
        2,
        'Righteous Bison',
      );
      expect(schema.fetchDefindexByName).toHaveBeenNthCalledWith(3, 'Winger');
      expect(schema.fetchDefindexByName).toHaveBeenNthCalledWith(
        4,
        'Backburner',
      );
      expect(schema.fetchDefindexByName).toHaveBeenNthCalledWith(5, 'Gunboats');
      expect(schema.fetchDefindexByName).toHaveBeenNthCalledWith(
        6,
        'Half-Zatoichi',
      );
      expect(schema.fetchDefindexByName).toHaveBeenNthCalledWith(7, 'Mad Milk');

      expect(schema.fetchQualityByName).toHaveBeenCalledTimes(8);
      for (let i = 1; i <= 6; i++) {
        expect(schema.fetchQualityByName).toHaveBeenNthCalledWith(i, 'Unique');
      }
      expect(schema.fetchQualityByName).toHaveBeenNthCalledWith(8, 'Strange');

      expect(parsed.output).toEqual(6522);

      expect(parsed.inputs).toEqual([
        {
          defindex: -1,
          quality: -1,
          amount: 5,
        },
        {
          defindex: -1,
          quality: -1,
          amount: 1,
        },
        {
          defindex: -1,
          quality: -1,
          amount: 1,
        },
        {
          defindex: -1,
          quality: -1,
          amount: 1,
        },
        {
          defindex: -1,
          quality: -1,
          amount: 1,
        },
        {
          defindex: -1,
          quality: -1,
          amount: 1,
        },
      ]);
    });

    it("will parse Collector's Chemistry Sets", async () => {
      const item = TestData.getCollectorsChemistrySet();

      mockSchema();

      const extracted = parser.extract(item);
      const parsed = await parser.parse(extracted);

      expect(schema.fetchDefindexByName).toHaveBeenCalledTimes(2);
      expect(schema.fetchDefindexByName).toHaveBeenNthCalledWith(
        1,
        'Sharpened Volcano Fragment',
      );
      expect(schema.fetchDefindexByName).toHaveBeenNthCalledWith(
        2,
        'Sharpened Volcano Fragment',
      );

      expect(schema.fetchQualityByName).toHaveBeenCalledTimes(3);
      expect(schema.fetchQualityByName).toHaveBeenNthCalledWith(1, 'Unique');
      expect(schema.fetchQualityByName).toHaveBeenNthCalledWith(
        2,
        "Collector's",
      );
      expect(schema.fetchQualityByName).toHaveBeenNthCalledWith(3, 'Unique');

      expect(parsed.defindex).toEqual(20006);
      expect(parsed.inputs).toEqual([
        {
          defindex: -1,
          quality: -1,
          amount: 1,
        },
      ]);
    });

    it('will parse Normal quality items', async () => {
      const item = TestData.getNormalQualityItem();

      mockSchema();

      schema.getQualityByName.mockReturnValueOnce(0);

      const extracted = parser.extract(item);
      const parsed = await parser.parse(extracted);

      expect(schema.getQualityByName).toHaveBeenCalledTimes(1);
      expect(schema.getQualityByName).toHaveBeenNthCalledWith(1, 'Normal');

      expect(parsed.quality).toEqual(0);
    });
  });
});

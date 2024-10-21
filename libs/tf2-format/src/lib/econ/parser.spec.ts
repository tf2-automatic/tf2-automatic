import { EconParser } from './parser';
import { EconItem, Tag } from './types';
import * as TestData from './test-data';

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

  describe('#prepare', () => {
    it('will parse basic attributes', () => {
      const item = TestData.getBasicItem();

      const prepared = EconParser.prepare(item);

      expect(prepared.assetid).toEqual('13658582638');
      expect(prepared.defindex).toEqual(5021);
      expect(prepared.quality).toEqual('Unique');
      expect(prepared.craftable).toEqual(true);
      expect(prepared.tradable).toEqual(true);
    });

    it('will parse Strangifier Chemistry Sets', () => {
      const item = TestData.getStrangifierChemistrySet();
      const prepared = EconParser.prepare(item);

      expect(prepared.input).toEqual([
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

      expect(prepared.quality).toEqual('Unique');
      expect(prepared.output).toEqual('Professor Speks');
      expect(prepared.outputQuality).toEqual('Strange');
      expect(prepared.target).toEqual(null);
      expect(prepared.uses).toEqual(1);
    });

    it('will parse Strangifiers', () => {
      const item = TestData.getStrangifier();

      const prepared = EconParser.prepare(item);

      expect(prepared.quality).toEqual('Unique');
      expect(prepared.target).toEqual("Cleaner's Carbine");
      expect(prepared.output).toEqual(null);
    });

    it("will parse Collector's Chemistry Sets", () => {
      const item = TestData.getCollectorsChemistrySet();

      const prepared = EconParser.prepare(item);

      expect(prepared.output).toEqual('Sharpened Volcano Fragment');
      expect(prepared.outputQuality).toEqual("Collector's");
      expect(prepared.target).toEqual(null);
      expect(prepared.input).toEqual([
        {
          name: 'Sharpened Volcano Fragment',
          amount: 1,
        },
      ]);
    });

    it('will parse Unusualifiers', () => {
      const item = TestData.getUnusualifier();

      const prepared = EconParser.prepare(item);

      expect(prepared.target).toEqual('Taunt: Spin-to-Win');
      expect(prepared.output).toEqual(null);
    });

    it('will parse Professional Killstreak Kit Fabricators', () => {
      const item = TestData.getKillstreakKitFabricator();

      const prepared = EconParser.prepare(item);

      expect(prepared.output).toEqual('Kit');
      expect(prepared.outputQuality).toEqual('Unique');
      expect(prepared.target).toEqual('Splendid Screen');
      expect(prepared.killstreaker).toEqual('Tornado');
      expect(prepared.sheen).toEqual('Hot Rod');
      expect(prepared.killstreak).toEqual(3);
    });

    it('will parse Professional Kilstreak Kits', () => {
      const item = TestData.getKillstreakKit();

      const prepared = EconParser.prepare(item);

      expect(prepared.killstreaker).toEqual('Hypno-Beam');
      expect(prepared.sheen).toEqual('Villainous Violet');
      expect(prepared.killstreak).toEqual(3);
      expect(prepared.target).toEqual("Hitman's Heatmaker");
    });

    it('will detect elevated qualities for haunted items', () => {
      const item = TestData.getHauntedElevatedQualityItem();

      const prepared = EconParser.prepare(item);

      expect(prepared.quality).toEqual('Haunted');
      expect(prepared.elevated).toEqual(true);
      expect(prepared.parts).toEqual([
        'Carnival Underworld Kills',
        'Carnival Games Won',
      ]);
    });

    it('will detect elevated qualities for unusual items', () => {
      const item = TestData.getUnusualElevatedQualityItem();

      const prepared = EconParser.prepare(item);

      expect(prepared.quality).toEqual('Unusual');
      expect(prepared.elevated).toEqual(true);
    });

    it('will parse decorated weapons', () => {
      const item = TestData.getDecoratedWeapon();

      const prepared = EconParser.prepare(item);

      expect(prepared.wear).toEqual('Factory New');
      expect(prepared.paintkit).toEqual('Civil Servant Mk.II');
      expect(prepared.quality).toEqual('Decorated Weapon');
    });

    it('will parse War Paints', () => {
      const item = TestData.getWarPaint();

      const prepared = EconParser.prepare(item);

      expect(prepared.wear).toEqual('Field-Tested');
      expect(prepared.paintkit).toEqual('Sweet Toothed');
      expect(prepared.quality).toEqual('Decorated Weapon');
    });

    it('will parse painted cosmetic items', () => {
      const item = TestData.getPaintedCosmetic();

      const prepared = EconParser.prepare(item);

      expect(prepared.defindex).toEqual(30367);
      expect(prepared.quality).toEqual('Unique');
      expect(prepared.craftable).toEqual(true);
      expect(prepared.tradable).toEqual(true);
      expect(prepared.paint).toEqual('Team Spirit');
    });

    it('will parse dueling mini-games', () => {
      const item = TestData.getDuelingMiniGame();

      const prepared = EconParser.prepare(item);

      expect(prepared.defindex).toEqual(241);
      expect(prepared.quality).toEqual('Unique');
      expect(prepared.craftable).toEqual(true);
      expect(prepared.tradable).toEqual(true);
      expect(prepared.uses).toEqual(5);
    });

    it('will parse giftapults', () => {
      const item = TestData.getGiftapult();

      const prepared = EconParser.prepare(item);

      expect(prepared.defindex).toEqual(5083);
      expect(prepared.quality).toEqual('Unique');
      expect(prepared.craftable).toEqual(true);
      expect(prepared.tradable).toEqual(false);
      expect(prepared.uses).toEqual(1);
    });

    it('will parse strange parts', () => {
      const item = TestData.getStrangePart();

      const prepared = EconParser.prepare(item);

      expect(prepared.defindex).toEqual(6012);
      expect(prepared.quality).toEqual('Unique');
      expect(prepared.craftable).toEqual(true);
      expect(prepared.tradable).toEqual(true);
    });

    it('will parse Australium Gold', () => {
      const item = TestData.getAustraliumGold();

      const prepared = EconParser.prepare(item);

      expect(prepared.defindex).toEqual(5037);
      expect(prepared.quality).toEqual('Unique');
      expect(prepared.craftable).toEqual(true);
      expect(prepared.tradable).toEqual(true);
      expect(prepared.australium).toEqual(false);
    });

    it('will parse australium weapons', () => {
      const item = TestData.getAustraliumWeapon();

      const prepared = EconParser.prepare(item);

      expect(prepared.defindex).toEqual(205);
      expect(prepared.quality).toEqual('Strange');
      expect(prepared.craftable).toEqual(true);
      expect(prepared.tradable).toEqual(true);
      expect(prepared.australium).toEqual(true);
    });

    it('will parse festivized items', () => {
      const item = TestData.getFestivizedItem();

      const prepared = EconParser.prepare(item);

      expect(prepared.defindex).toEqual(200);
      expect(prepared.quality).toEqual('Strange');
      expect(prepared.craftable).toEqual(true);
      expect(prepared.tradable).toEqual(true);
      expect(prepared.festivized).toEqual(true);
    });

    it('will not parse effects from crates', () => {
      const item = TestData.getCrateWithEffects();

      const prepared = EconParser.prepare(item);

      expect(prepared.effect).toBeNull();
    });

    it('will not parse texture when missing exterior tag', () => {
      const item = TestData.getCosmeticWithGrade();

      const prepared = EconParser.prepare(item);

      expect(prepared.paintkit).toBeNull();
    });
  });
});

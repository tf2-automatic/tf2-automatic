import { BptfParser } from './parser';
import * as TestData from './test-data';
import { BptfParserSchema } from '../../schemas';

describe('BptfParser', () => {
  describe('#extract', () => {
    let parser: BptfParser;

    beforeEach(() => {
      const schema: BptfParserSchema = {
        getDefindexByName: jest.fn(),
        fetchDefindexByName: jest.fn(),
        getQualityByName: jest.fn(),
        fetchQualityByName: jest.fn(),
        getSpellByName: jest.fn(),
        fetchSpellByName: jest.fn(),
      };

      parser = new BptfParser(schema);
    });

    it('will parse basic attributes', () => {
      const item = TestData.getBasicItem();

      const extracted = parser.extract(item);

      expect(extracted.assetid).toEqual('15681438673');
      expect(extracted.originalId).toEqual('10638364157');
      expect(extracted.defindex).toEqual(5021);
      expect(extracted.quality).toEqual(6);
      expect(extracted.craftable).toEqual(true);
      expect(extracted.tradable).toEqual(true);
    });

    it('will parsea "synthetic" item', () => {
      const item = TestData.getFunnyItem();

      const extracted = parser.extract(item);

      // This is a buy listing, so it has no id.
      expect(extracted.assetid).toEqual(null);
      expect(extracted.originalId).toEqual(null);
      expect(extracted.defindex).toEqual(378);
      expect(extracted.quality).toEqual(6);
      expect(extracted.elevatedQuality).toEqual(11);
      expect(extracted.craftable).toEqual(true);
      expect(extracted.tradable).toEqual(true);
      expect(extracted.australium).toEqual(false);
      expect(extracted.festivized).toEqual(true);
      expect(extracted.effect).toEqual(4);
      expect(extracted.wear).toEqual(1);
      expect(extracted.paint).toEqual(5052);
      expect(extracted.killstreak).toEqual(1);
      expect(extracted.sheen).toEqual(1);
      expect(extracted.killstreaker).toEqual(2002);
      expect(extracted.spells).toEqual([
        'Exorcism',
        'Voices from Below',
        'Pumpkin Bombs',
      ]);
      expect(extracted.parts).toEqual([]);
      expect(extracted.paintkit).toEqual(82);
      expect(extracted.quantity).toEqual(null);
      expect(extracted.inputs).toEqual([]);
      expect(extracted.output).toEqual(725);
      expect(extracted.outputQuality).toEqual(6);
      expect(extracted.target).toEqual(null);
      expect(extracted.crateSeries).toEqual(null);
    });

    it('will parse kit fabricators', () => {
      const item = TestData.getItemWithParts();

      const extracted = parser.extract(item);

      expect(extracted.quality).toEqual(11);
      expect(extracted.parts).toEqual([6005, 6001, 6004]);
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
          name: 'The Fists of Steel',
        },
        {
          quantity: 1,
          name: 'The Ambassador',
        },
        {
          quantity: 1,
          name: 'The Spy-cicle',
        },
        {
          quantity: 1,
          name: 'The Sandvich',
        },
        {
          quantity: 1,
          name: 'The Blutsauger',
        },
        {
          quantity: 1,
          name: 'The Axtinguisher',
        },
        {
          quantity: 1,
          name: 'Strange Killing Gloves of Boxing',
        },
      ]);
      expect(extracted.output).toEqual(6522);
    });

    it('will parse dueling minigames', () => {
      const item = TestData.getDuelingMinigame();

      const extracted = parser.extract(item);

      expect(extracted.assetid).toEqual('15568852549');
      expect(extracted.quantity).toEqual(5);
    });

    it('will parse killstreak kits', () => {
      const item = TestData.getKillstreakKit();

      const extracted = parser.extract(item);

      expect(extracted.defindex).toEqual(6527);
      expect(extracted.killstreak).toEqual(1);
      expect(extracted.sheen).toEqual(null);
      expect(extracted.killstreaker).toEqual(null);
      expect(extracted.inputs).toEqual([]);
      expect(extracted.target).toEqual(206);
      expect(extracted.output).toEqual(null);
    });

    it('will parse professional killstreak kit fabricators', () => {
      const item = TestData.getProfessionalKillstreakKitFabricator();

      const extracted = parser.extract(item);

      expect(extracted.assetid).toEqual('15443117973');
      expect(extracted.defindex).toEqual(20003);
      expect(extracted.quality).toEqual(6);
      expect(extracted.inputs).toEqual([
        {
          quantity: 2,
          name: 'Specialized Killstreak Item',
        },
        {
          quantity: 13,
          name: 'Battle-Worn Robot KB-808',
        },
        {
          quantity: 3,
          name: 'Battle-Worn Robot Money Furnace',
        },
        {
          quantity: 4,
          name: 'Reinforced Robot Emotion Detector',
        },
        {
          quantity: 2,
          name: 'Reinforced Robot Bomb Stabilizer',
        },
        {
          quantity: 3,
          name: 'Pristine Robot Brainstorm Bulb',
        },
      ]);
      // This is pretty dumb, but backpack.tf does not modify the killstreak tier, even when killstreaker and sheen are present.
      expect(extracted.killstreak).toEqual(0);
      expect(extracted.sheen).toEqual(7);
      expect(extracted.killstreaker).toEqual(2004);
      expect(extracted.output).toEqual(6526);
      expect(extracted.target).toEqual(406);
    });
  });

  describe('#parse', () => {
    let parser: BptfParser;
    let schema: Record<keyof BptfParserSchema, jest.Mock>;

    function mockSchema() {
      schema.getDefindexByName.mockReturnValue(undefined);
      schema.fetchDefindexByName.mockResolvedValue(-1);
      schema.getQualityByName.mockReturnValue(undefined);
      schema.fetchQualityByName.mockResolvedValue(-1);
      schema.getSpellByName.mockReturnValue(undefined);
      schema.fetchSpellByName.mockResolvedValue(-1);
    }

    beforeEach(() => {
      schema = {
        getDefindexByName: jest.fn(),
        fetchDefindexByName: jest.fn(),
        getQualityByName: jest.fn(),
        fetchQualityByName: jest.fn(),
        getSpellByName: jest.fn(),
        fetchSpellByName: jest.fn(),
      };

      parser = new BptfParser(schema);
    });

    it('will parse a basic item', async () => {
      const item = TestData.getBasicItem();

      const extracted = parser.extract(item);

      const parsed = await parser.parse(extracted);

      expect(parsed.assetid).toEqual('15681438673');
      expect(parsed.defindex).toEqual(5021);
      expect(parsed.quality).toEqual(6);
      expect(parsed.craftable).toEqual(true);
      expect(parsed.tradable).toEqual(true);
    });

    it('will parse spells', async () => {
      const item = TestData.getFunnyItem();

      const extracted = parser.extract(item);

      mockSchema();

      const parsed = await parser.parse(extracted);

      expect(parsed.spells).toEqual([-1, -1, -1]);
      expect(schema.getSpellByName).toHaveBeenCalledTimes(3);
      expect(schema.fetchSpellByName).toHaveBeenCalledTimes(3);
      expect(schema.fetchSpellByName).toHaveBeenNthCalledWith(1, 'Exorcism');
      expect(schema.fetchSpellByName).toHaveBeenNthCalledWith(
        2,
        'Voices from Below',
      );
      expect(schema.fetchSpellByName).toHaveBeenNthCalledWith(
        3,
        'Pumpkin Bombs',
      );
    });

    it('will parse strangifier chemistry sets', async () => {
      const item = TestData.getStrangifierChemistrySet();

      const extracted = parser.extract(item);

      mockSchema();

      const parsed = await parser.parse(extracted);

      expect(schema.fetchDefindexByName).toHaveBeenCalledTimes(7);
      expect(schema.fetchDefindexByName).toHaveBeenNthCalledWith(
        1,
        'Fists of Steel',
      );
      expect(schema.fetchDefindexByName).toHaveBeenNthCalledWith(
        2,
        'Ambassador',
      );
      expect(schema.fetchDefindexByName).toHaveBeenNthCalledWith(
        3,
        'Spy-cicle',
      );
      expect(schema.fetchDefindexByName).toHaveBeenNthCalledWith(4, 'Sandvich');
      expect(schema.fetchDefindexByName).toHaveBeenNthCalledWith(
        5,
        'Blutsauger',
      );
      expect(schema.fetchDefindexByName).toHaveBeenNthCalledWith(
        6,
        'Axtinguisher',
      );
      expect(schema.fetchDefindexByName).toHaveBeenNthCalledWith(
        7,
        'Killing Gloves of Boxing',
      );

      expect(schema.fetchQualityByName).toHaveBeenCalledTimes(7);
      for (let i = 1; i <= 6; i++) {
        expect(schema.fetchQualityByName).toHaveBeenNthCalledWith(i, 'Unique');
      }
      expect(schema.fetchQualityByName).toHaveBeenNthCalledWith(7, 'Strange');

      expect(parsed.output).toEqual(6522);

      expect(parsed.inputs).toEqual([
        {
          defindex: -1,
          quality: -1,
          quantity: 4,
        },
        {
          defindex: -1,
          quality: -1,
          quantity: 1,
        },
        {
          defindex: -1,
          quality: -1,
          quantity: 1,
        },
        {
          defindex: -1,
          quality: -1,
          quantity: 1,
        },
        {
          defindex: -1,
          quality: -1,
          quantity: 1,
        },
        {
          defindex: -1,
          quality: -1,
          quantity: 1,
        },
        {
          defindex: -1,
          quality: -1,
          quantity: 1,
        },
      ]);
    });

    it('will parse professional killstreak kit fabricators', async () => {
      const item = TestData.getProfessionalKillstreakKitFabricator();

      const extracted = parser.extract(item);

      mockSchema();

      const parsed = await parser.parse(extracted);

      expect(schema.fetchDefindexByName).toHaveBeenCalledTimes(5);
      expect(schema.fetchDefindexByName).toHaveBeenNthCalledWith(
        1,
        'Battle-Worn Robot KB-808',
      );
      expect(schema.fetchDefindexByName).toHaveBeenNthCalledWith(
        2,
        'Battle-Worn Robot Money Furnace',
      );
      expect(schema.fetchDefindexByName).toHaveBeenNthCalledWith(
        3,
        'Reinforced Robot Emotion Detector',
      );
      expect(schema.fetchDefindexByName).toHaveBeenNthCalledWith(
        4,
        'Reinforced Robot Bomb Stabilizer',
      );
      expect(schema.fetchDefindexByName).toHaveBeenNthCalledWith(
        5,
        'Pristine Robot Brainstorm Bulb',
      );

      expect(schema.fetchQualityByName).toHaveBeenCalledTimes(6);
      for (let i = 1; i <= 6; i++) {
        expect(schema.fetchQualityByName).toHaveBeenNthCalledWith(i, 'Unique');
      }

      expect(parsed.output).toEqual(6526);
      expect(parsed.target).toEqual(406);
      expect(parsed.killstreak).toEqual(3);
      expect(parsed.sheen).toEqual(7);
      expect(parsed.killstreaker).toEqual(2004);

      expect(parsed.inputs).toEqual([
        {
          killstreak: 2,
          quality: -1,
          quantity: 2,
        },
        {
          defindex: -1,
          quality: -1,
          quantity: 13,
        },
        {
          defindex: -1,
          quality: -1,
          quantity: 3,
        },
        {
          defindex: -1,
          quality: -1,
          quantity: 4,
        },
        {
          defindex: -1,
          quality: -1,
          quantity: 2,
        },
        {
          defindex: -1,
          quality: -1,
          quantity: 3,
        },
      ]);
    });
  });
});

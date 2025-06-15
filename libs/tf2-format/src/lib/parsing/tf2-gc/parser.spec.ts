import { TF2GCParser } from './parser';
import * as TestData from './test-data';
import { ItemsGameItem } from '../../types';
import { TF2ParserSchema } from '../../schemas';

describe('TF2GCParser', () => {
  describe('#extract', () => {
    let parser: TF2GCParser;

    beforeEach(() => {
      const schema: TF2ParserSchema = {
        getItemsGameItemByDefindex: jest.fn(),
        fetchItemsGameItemByDefindex: jest.fn(),
        getPaintByColor: jest.fn(),
        fetchPaintByColor: jest.fn(),
        getStrangePartById: jest.fn(),
        fetchStrangePartById: jest.fn(),
      };

      parser = new TF2GCParser(schema);
    });

    it('will parse basic attributes', () => {
      const item = TestData.getBasicItem();

      const [extracted] = parser.extract(item);

      expect(extracted.assetid).toEqual('11246487609');
      expect(extracted.defindex).toEqual(5021);
      expect(extracted.quality).toEqual(6);
      expect(extracted.quantity).toEqual(1);
      expect(extracted.level).toEqual(5);
    });

    it('will parse unusuals', () => {
      const item = TestData.getUnusualAndPainted();

      const [extracted] = parser.extract(item);

      expect(extracted.assetid).toEqual('15442874590');
      expect(extracted.defindex).toEqual(920);
      expect(extracted.quality).toEqual(5);
      expect(extracted.effect).toEqual(10);
      expect(extracted.primaryPaint).toEqual(16738740);
      expect(extracted.secondaryPaint).toEqual(16738740);
    });

    it('will parse basic killstreaks', () => {
      const item = TestData.getBasicKillstreak();

      const [extracted] = parser.extract(item);

      expect(extracted.assetid).toEqual('15497772888');
      expect(extracted.defindex).toEqual(208);
      expect(extracted.quality).toEqual(6);
      expect(extracted.killstreak).toEqual(1);
    });

    it('will parse paintkit items', () => {
      const item = TestData.getPaintKitItem();

      const [extracted] = parser.extract(item);

      expect(extracted.assetid).toEqual('15443117830');
      expect(extracted.defindex).toEqual(327);
      expect(extracted.quality).toEqual(15);
      expect(extracted.wear).toEqual(4);
      expect(extracted.paintkit).toEqual(211);
    });

    it('will parse australium items', () => {
      const item = TestData.getAustraliumItem();

      const [extracted] = parser.extract(item);

      expect(extracted.assetid).toEqual('15497772895');
      expect(extracted.defindex).toEqual(45);
      expect(extracted.quality).toEqual(11);
      expect(extracted.australium).toEqual(true);
    });

    it('will parse professional killstreak items', () => {
      const item = TestData.getProfessionalKillstreakItem();

      const [extracted] = parser.extract(item);

      expect(extracted.assetid).toEqual('15497962225');
      expect(extracted.defindex).toEqual(154);
      expect(extracted.quality).toEqual(11);
      expect(extracted.killstreak).toEqual(3);
      expect(extracted.sheen).toEqual(6);
      expect(extracted.killstreaker).toEqual(2003);
    });

    it('will parse exorcism spelled items', () => {
      const item = TestData.getExorcismSpelledItem();

      const [extracted] = parser.extract(item);

      expect(extracted.assetid).toEqual('15446477485');
      expect(extracted.defindex).toEqual(215);
      expect(extracted.quality).toEqual(6);
      expect(extracted.spells).toEqual([[1009, 1]]);
    });

    it('will parse festivized items', () => {
      const item = TestData.getFestivizedItem();

      const [extracted] = parser.extract(item);

      expect(extracted.assetid).toEqual('15507421094');
      expect(extracted.defindex).toEqual(1153);
      expect(extracted.festivized).toEqual(true);
    });

    it('will parse killstreak fabricators', () => {
      const item = TestData.getProfessionalKillstreakKitFabricator();

      const [extracted] = parser.extract(item);

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

      const [extracted] = parser.extract(item);

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

    it('will parse basic killstreak kits', () => {
      const item = TestData.getBasicKillstreakKit();

      const [extracted] = parser.extract(item);

      expect(extracted.assetid).toEqual('15443117883');
      expect(extracted.defindex).toEqual(6527);
      expect(extracted.quality).toEqual(6);
      expect(extracted.target).toEqual(206);
      expect(extracted.killstreak).toEqual(1);
    });

    it('will parse collectors chemistry sets', () => {
      const item = TestData.getCollectorsChemistrySet();

      const [extracted] = parser.extract(item);

      expect(extracted.assetid).toEqual('15511116952');
      expect(extracted.defindex).toEqual(20007);
      expect(extracted.quality).toEqual(6);
      expect(extracted.outputQuality).toEqual(14);
      expect(extracted.output).toEqual(1080);
      expect(extracted.inputs).toEqual([
        { quantity: 193, defindex: 1080, quality: 6 },
      ]);
    });

    it('will parse dueling minigames', () => {
      const item = TestData.getDuelingMinigame();

      const [extracted] = parser.extract(item);

      expect(extracted.assetid).toEqual('15568852549');
      expect(extracted.defindex).toEqual(241);
      expect(extracted.quality).toEqual(6);
      expect(extracted.quantity).toEqual(5);
    });
  });

  describe('#parse', () => {
    let parser: TF2GCParser;
    let schema: TF2ParserSchema;

    beforeEach(() => {
      schema = {
        getItemsGameItemByDefindex: jest.fn(),
        fetchItemsGameItemByDefindex: jest.fn(),
        getPaintByColor: jest.fn(),
        fetchPaintByColor: jest.fn(),
        getStrangePartById: jest.fn(),
        fetchStrangePartById: jest.fn(),
      };

      parser = new TF2GCParser(schema);
    });

    it('will parse a basic item', async () => {
      const item = TestData.getBasicItem();

      const [extracted, context] = parser.extract(item);

      schema.getItemsGameItemByDefindex = jest.fn().mockReturnValue({
        name: 'Decoder Ring',
        attributes: {
          'always tradable': {
            attribute_class: 'always_tradable',
            value: '1',
          },
        },
        static_attrs: {
          'is commodity': '1',
        },
      } satisfies ItemsGameItem);

      schema.getPaintByColor = jest.fn().mockReturnValue(211);

      const parsed = await parser.parse(extracted, context);

      expect(parsed.assetid).toEqual('11246487609');
      expect(parsed.defindex).toEqual(5021);
      expect(parsed.quality).toEqual(6);
      expect(parsed.craftable).toEqual(true);
      expect(parsed.tradable).toEqual(true);
    });

    it('will parse painted unusual', async () => {
      const item = TestData.getUnusualAndPainted();

      const [extracted, context] = parser.extract(item);

      schema.getItemsGameItemByDefindex = jest.fn().mockReturnValue({
        name: "The Crone's Dome",
        capabilities: {
          paintable: '1',
        },
      } satisfies ItemsGameItem);

      schema.getPaintByColor = jest.fn().mockReturnValue(211);

      const parsed = await parser.parse(extracted, context);

      expect(parsed.assetid).toEqual('15442874590');
      expect(parsed.defindex).toEqual(920);
      expect(parsed.quality).toEqual(5);
      expect(parsed.craftable).toEqual(true);
      expect(parsed.tradable).toEqual(true);
      expect(parsed.paint).toEqual(211);
    });
  });
});

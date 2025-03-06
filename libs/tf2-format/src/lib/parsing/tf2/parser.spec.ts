import { TF2Parser } from './parser';
import * as TestData from './test-data';
import { ItemsGameItem, TF2ParserSchema } from '../../types';

describe('TF2Parser', () => {
  describe('#extract', () => {
    let parser: TF2Parser;

    beforeEach(() => {
      const schema: TF2ParserSchema = {
        getItemByDefindex: jest.fn(),
        fetchItemByDefindex: jest.fn(),
        getSpellById: jest.fn(),
        fetchSpellById: jest.fn(),
        getPaintByColor: jest.fn(),
        fetchPaintByColor: jest.fn(),
        getStrangePartById: jest.fn(),
        fetchStrangePartById: jest.fn(),
      };

      parser = new TF2Parser(schema);
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
      expect(extracted.spells).toEqual([1009]);
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
        { quality: 6, amount: 2, killstreak: 2 },
        { quality: 6, amount: 13, defindex: 5706 },
        { quality: 6, amount: 3, defindex: 5707 },
        { quality: 6, amount: 4, defindex: 5702 },
        { quality: 6, amount: 2, defindex: 5704 },
        { quality: 6, amount: 3, defindex: 5701 },
      ]);
      expect(extracted.killstreak).toEqual(3);
      expect(extracted.sheen).toEqual(7);
      expect(extracted.killstreaker).toEqual(2004);
      expect(extracted.output).toEqual(6526);
    });

    it('will parse strangifier chemistry sets', () => {
      const item = TestData.getStrangifierChemistrySet();

      const [extracted] = parser.extract(item);

      expect(extracted.assetid).toEqual('15510439400');
      expect(extracted.defindex).toEqual(20005);
      expect(extracted.quality).toEqual(6);
      expect(extracted.inputs).toEqual([
        {
          amount: 4,
          defindex: 331,
          quality: 6,
        },
        {
          amount: 1,
          defindex: 61,
          quality: 6,
        },
        {
          amount: 1,
          defindex: 649,
          quality: 6,
        },
        {
          amount: 1,
          defindex: 42,
          quality: 6,
        },
        {
          amount: 1,
          defindex: 36,
          quality: 6,
        },
        {
          amount: 1,
          defindex: 38,
          quality: 6,
        },
        {
          amount: 1,
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
    });
  });

  describe('#parse', () => {
    let parser: TF2Parser;
    let schema: TF2ParserSchema;

    beforeEach(() => {
      schema = {
        getItemByDefindex: jest.fn(),
        fetchItemByDefindex: jest.fn(),
        getSpellById: jest.fn(),
        fetchSpellById: jest.fn(),
        getPaintByColor: jest.fn(),
        fetchPaintByColor: jest.fn(),
        getStrangePartById: jest.fn(),
        fetchStrangePartById: jest.fn(),
      };

      parser = new TF2Parser(schema);
    });

    it('will parse a basic item', async () => {
      const item = TestData.getBasicItem();

      const [extracted, context] = parser.extract(item);

      schema.getItemByDefindex = jest.fn().mockReturnValue({
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

      schema.getItemByDefindex = jest.fn().mockReturnValue({
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

    it('will parse exorcism spelled items', async () => {
      const item = TestData.getExorcismSpelledItem();

      const [extracted, context] = parser.extract(item);

      schema.getItemByDefindex = jest.fn().mockReturnValue({
        name: 'The Degreaser',
      } satisfies ItemsGameItem);

      const parsed = await parser.parse(extracted, context);

      expect(parsed.spells).toEqual([1009]);
    });

    it('will parse weird spells', async () => {
      const item = TestData.getExorcismSpelledItem();

      const [extracted, context] = parser.extract(item);

      extracted.spells = [[1004, 1]];

      schema.getItemByDefindex = jest.fn().mockReturnValue({
        name: 'The Degreaser',
      } satisfies ItemsGameItem);
      schema.getSpellById = jest.fn().mockReturnValue(8902);

      const parsed = await parser.parse(extracted, context);

      expect(schema.getSpellById).toHaveBeenCalledWith(1004, 1);

      expect(parsed.spells).toEqual([8902]);
    });
  });
});

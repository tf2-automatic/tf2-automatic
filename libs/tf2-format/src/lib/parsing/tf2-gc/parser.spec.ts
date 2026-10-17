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

    it('will not make self-made items craftable', async () => {
      const item = TestData.getUnusualAndPainted();
      item.quality = 9;

      const [extracted, context] = parser.extract(item);

      schema.getItemsGameItemByDefindex = jest.fn().mockReturnValue({
        name: "The Crone's Dome",
      } satisfies ItemsGameItem);
      schema.getPaintByColor = jest.fn().mockReturnValue(211);

      const parsed = await parser.parse(extracted, context);

      expect(parsed.craftable).toEqual(false);
      expect(parsed.tradable).toEqual(false);
    });

    it('will not make temporary items tradable', async () => {
      const item = TestData.getUnusualAndPainted();

      const [extracted, context] = parser.extract(item);

      schema.getItemsGameItemByDefindex = jest.fn().mockReturnValue({
        name: "The Crone's Dome",
        static_attrs: {
          'expiration date': '1',
        },
      } satisfies ItemsGameItem);
      schema.getPaintByColor = jest.fn().mockReturnValue(211);

      const parsed = await parser.parse(extracted, context);

      expect(parsed.craftable).toEqual(false);
      expect(parsed.tradable).toEqual(false);
    });

    it('will not make free contract rewards tradable', async () => {
      const item = {
        ...TestData.getBasicItem(),
        id: '7897088103',
        account_id: 454318713,
        inventory: 2147485394,
        def_index: 1178,
        level: 30,
        flags: 0,
        origin: 29,
        original_id: null,
        position: 1746,
      };

      const [extracted, context] = parser.extract(item);

      schema.getItemsGameItemByDefindex = jest.fn().mockReturnValue({
        name: "The Dragon's Fury",
      } satisfies ItemsGameItem);

      const parsed = await parser.parse(extracted, context);

      expect(parsed.tradable).toEqual(false);
    });

    it('will not make purchased items craftable without can_craft_if_purchased', async () => {
      const item = {
        ...TestData.getBasicItem(),
        def_index: 725,
        origin: 2,
        flags: 20,
      };

      const [extracted, context] = parser.extract(item);

      schema.getItemsGameItemByDefindex = jest.fn().mockReturnValue({
        name: 'Tour of Duty Ticket',
      } satisfies ItemsGameItem);

      const parsed = await parser.parse(extracted, context);

      expect(parsed.craftable).toEqual(false);
      expect(parsed.tradable).toEqual(true);
    });

    it('will make purchased items craftable with can_craft_if_purchased', async () => {
      const item = {
        ...TestData.getBasicItem(),
        def_index: 30921,
        origin: 2,
        flags: 20,
      };

      const [extracted, context] = parser.extract(item);

      schema.getItemsGameItemByDefindex = jest.fn().mockReturnValue({
        name: "Taunt: Runner's Rhythm",
        capabilities: { can_craft_count: '1', can_craft_if_purchased: '1' },
      } satisfies ItemsGameItem);

      const parsed = await parser.parse(extracted, context);

      expect(parsed.craftable).toEqual(true);
    });

    it('will take the paintkit of war paints from the definition', async () => {
      const item = {
        ...TestData.getBasicItem(),
        def_index: 16139,
        quality: 15,
        origin: 8,
        flags: 4,
      };

      const [extracted, context] = parser.extract(item);

      schema.getItemsGameItemByDefindex = jest.fn().mockReturnValue({
        name: 'Paintkit 139',
        static_attrs: { paintkit_proto_def_index: '139' },
      } satisfies ItemsGameItem);

      const parsed = await parser.parse(extracted, context);

      expect(parsed.paintkit).toEqual(139);
    });

    const paintCan = {
      attribute: [
        {
          def_index: 153,
          value: null,
          value_bytes: { type: 'Buffer' as const, data: [0, 0, 0, 0] },
        },
      ],
      id: '15280280552',
      def_index: 5031,
      quantity: 1,
      level: 5,
      quality: 6,
      flags: 0,
      origin: 6,
      inventory: 2147485382,
      account_id: 454318713,
      equipped_state: [],
      custom_name: null,
      custom_desc: null,
      interior_item: null,
      in_use: false,
      style: 0,
      original_id: null,
      contains_equipped_state: null,
      contains_equipped_state_v2: true,
      position: 1734,
    };

    const tint = {
      'set item tint RGB': {
        attribute_class: 'set_item_tint_rgb',
        value: '8208497',
      },
    };

    it('will take the paint of paint cans from the definition', async () => {
      const [extracted, context] = parser.extract(paintCan);

      schema.getItemsGameItemByDefindex = jest.fn().mockReturnValue({
        name: 'Paint Can 6',
        tool: { type: 'paint_can' },
        attributes: tint,
      } satisfies ItemsGameItem);
      schema.getPaintByColor = jest.fn().mockReturnValue(5031);

      const parsed = await parser.parse(extracted, context);

      expect(schema.getPaintByColor).toHaveBeenCalledWith('7d4071');
      expect(parsed.paint).toEqual(5031);
    });

    it('will not give a paint to non paint cans with a tint', async () => {
      const [extracted, context] = parser.extract(paintCan);

      schema.getItemsGameItemByDefindex = jest.fn().mockReturnValue({
        name: 'Halloween Spell: Putrescent Pigmentation',
        tool: { type: 'apply_custom_attrib' },
        attributes: tint,
      } satisfies ItemsGameItem);
      schema.getPaintByColor = jest.fn().mockReturnValue(5031);

      const parsed = await parser.parse(extracted, context);

      expect(schema.getPaintByColor).not.toHaveBeenCalled();
      expect(parsed.paint).toEqual(null);
    });

    function uint32Attribute(defIndex: number, value: number) {
      const bytes = Buffer.alloc(4);
      bytes.writeUInt32LE(value);
      return {
        def_index: defIndex,
        value: null,
        value_bytes: { type: 'Buffer' as const, data: [...bytes] },
      };
    }

    async function parse(
      overrides: Partial<ReturnType<typeof TestData.getBasicItem>>,
      schemaItem: ItemsGameItem = { name: 'Item' },
    ) {
      const [extracted, context] = parser.extract({
        ...TestData.getBasicItem(),
        def_index: 1178,
        flags: 0,
        origin: 0,
        attribute: [],
        ...overrides,
      });
      schema.getItemsGameItemByDefindex = jest.fn().mockReturnValue(schemaItem);
      return parser.parse(extracted, context);
    }

    const alwaysTradable: ItemsGameItem = {
      name: 'Item',
      attributes: {
        'always tradable': { attribute_class: 'always_tradable', value: '1' },
      },
    };

    it('will make a plain item craftable and tradable', async () => {
      const parsed = await parse({});

      expect(parsed.craftable).toEqual(true);
      expect(parsed.tradable).toEqual(true);
    });

    it('will not make non economy items craftable or tradable', async () => {
      const parsed = await parse({ flags: 1 << 3 }, alwaysTradable);

      expect(parsed.craftable).toEqual(false);
      expect(parsed.tradable).toEqual(false);
    });

    it('will not make items flagged as not usable in crafting craftable', async () => {
      const parsed = await parse({ flags: 1 << 1 });

      expect(parsed.craftable).toEqual(false);
      expect(parsed.tradable).toEqual(true);
    });

    it('will make always tradable items craftable even when flagged as not usable in crafting', async () => {
      const parsed = await parse({ flags: 1 << 1 }, alwaysTradable);

      expect(parsed.craftable).toEqual(true);
    });

    it('will not make preview items craftable', async () => {
      const parsed = await parse({ origin: 17 });

      expect(parsed.craftable).toEqual(false);
      expect(parsed.tradable).toEqual(false);
    });

    it('will not make quest loaner items craftable or tradable', async () => {
      const parsed = await parse({ attribute: [uint32Attribute(2051, 1)] });

      expect(parsed.craftable).toEqual(false);
      expect(parsed.tradable).toEqual(false);
    });

    it('will not make items whose definition expires craftable or tradable', async () => {
      const parsed = await parse(
        {},
        { name: 'Item', expiration_date: '2014-11-11 01:00:00' },
      );

      expect(parsed.craftable).toEqual(false);
      expect(parsed.tradable).toEqual(false);
    });

    it('will not make items tradable before their tradable after date', async () => {
      const tomorrow = Math.floor(Date.now() / 1000) + 24 * 60 * 60;

      const parsed = await parse(
        { attribute: [uint32Attribute(211, tomorrow)] },
        alwaysTradable,
      );

      expect(parsed.tradable).toEqual(false);
    });

    it('will make items tradable after their tradable after date', async () => {
      const parsed = await parse({ attribute: [uint32Attribute(211, 1)] });

      expect(parsed.tradable).toEqual(true);
    });
  });
});

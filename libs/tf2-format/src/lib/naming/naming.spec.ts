import { ItemNamingSchema } from '../schemas';
import { NameGenerator } from './index';

describe('NameGenerator', () => {
  describe('#getName', () => {
    let generator: NameGenerator;
    let schema: Record<keyof ItemNamingSchema, jest.Mock>;

    beforeEach(() => {
      schema = {
        getSchemaItemByDefindex: jest.fn(),
        fetchSchemaItemByDefindex: jest.fn(),
        getQualityById: jest.fn(),
        fetchQualityById: jest.fn(),
        getEffectById: jest.fn(),
        fetchEffectById: jest.fn(),
        getPaintkitById: jest.fn(),
        fetchPaintkitById: jest.fn(),
      };

      generator = new NameGenerator(schema);
    });

    it('will create the name of a key', async () => {
      schema.getSchemaItemByDefindex.mockReturnValue({
        item_name: 'Mann Co. Supply Crate Key',
        proper_name: false,
        item_quality: 6,
      });

      const name = await generator.getName({
        defindex: 5021,
        quality: 6,
      });

      expect(name).toBe('Mann Co. Supply Crate Key');
    });

    it('will create the name of a killstreak kit fabricator', async () => {
      schema.getSchemaItemByDefindex.mockReturnValueOnce({
        item_name: 'Fabricator',
        proper_name: false,
        item_quality: 6,
      });
      schema.getSchemaItemByDefindex.mockReturnValueOnce({
        item_name: 'Splendid Screen',
      });
      schema.getSchemaItemByDefindex.mockReturnValueOnce({ item_name: 'Kit' });

      const name = await generator.getName({
        defindex: 20003,
        quality: 6,
        killstreak: 3,
        target: 406,
        output: 6526,
      });

      expect(name).toBe(
        'Professional Killstreak Splendid Screen Kit Fabricator',
      );
    });

    it('will create the name of an item with proper name true', async () => {
      schema.getSchemaItemByDefindex.mockReturnValueOnce({
        item_name: 'Team Captain',
        proper_name: true,
        item_quality: 6,
      });

      const name = await generator.getName({
        defindex: 378,
        quality: 6,
      });

      expect(name).toBe('The Team Captain');
    });

    it('will create the name of a prof ks strange festive item', async () => {
      schema.getSchemaItemByDefindex.mockReturnValueOnce({
        item_name: 'Stickybomb Launcher',
        proper_name: false,
        item_quality: 11,
      });
      schema.getQualityById.mockReturnValueOnce('Strange');

      const name = await generator.getName({
        defindex: 207,
        quality: 11,
        killstreak: 3,
        festivized: true,
      });

      expect(name).toBe(
        'Strange Festivized Professional Killstreak Stickybomb Launcher',
      );
    });

    it('will create the name of a collectors kit', async () => {
      schema.getSchemaItemByDefindex.mockReturnValueOnce({
        item_name: 'Chemistry Set',
        proper_name: false,
        item_quality: 6,
      });
      schema.getSchemaItemByDefindex.mockReturnValueOnce({
        item_name: 'Festive Sapper',
        proper_name: false,
        item_quality: 6,
      });
      schema.getQualityById.mockReturnValueOnce("Collector's");

      const name = await generator.getName({
        defindex: 20007,
        quality: 6,
        outputQuality: 14,
        output: 1080,
      });

      expect(name).toBe("Collector's Festive Sapper Chemistry Set");
    });

    it('will create the name of a skin', async () => {
      schema.getSchemaItemByDefindex.mockReturnValueOnce({
        item_name: 'Sniper Rifle',
        proper_name: true,
        item_quality: 15,
      });
      schema.getEffectById.mockReturnValueOnce('Isotope');
      schema.getPaintkitById.mockReturnValueOnce('Night Owl');

      const name = await generator.getName({
        defindex: 15000,
        quality: 15,
        effect: 702,
        wear: 1,
        paintkit: 14,
        killstreak: 3,
      });

      expect(name).toBe(
        'Isotope Professional Killstreak Night Owl Sniper Rifle (Factory New)',
      );
    });

    it('will create the name of a crate', async () => {
      schema.getSchemaItemByDefindex.mockReturnValueOnce({
        item_name: 'Unlocked Winter 2016 Cosmetic Case',
        proper_name: false,
        item_quality: 6,
      });

      const name = await generator.getName({
        defindex: 5865,
        quality: 6,
        craftable: false,
        crateSeries: 105,
      });

      expect(name).toBe(
        'Non-Craftable Unlocked Winter 2016 Cosmetic Case #105',
      );
    });

    it('will create the name of a strange australium rocket launcher', async () => {
      schema.getSchemaItemByDefindex.mockReturnValueOnce({
        item_name: 'Rocket Launcher',
        proper_name: false,
        item_quality: 6,
      });
      schema.getQualityById.mockReturnValueOnce('Strange');

      const name = await generator.getName({
        defindex: 205,
        quality: 11,
        australium: true,
      });

      expect(name).toBe('Strange Australium Rocket Launcher');
    });

    it('will create the name of an item with elevated quality', async () => {
      schema.getSchemaItemByDefindex.mockReturnValueOnce({
        item_name: 'Hong Kong Cone',
        proper_name: false,
        item_quality: 6,
      });
      schema.getQualityById.mockReturnValueOnce('Strange');
      schema.getEffectById.mockReturnValueOnce('Circling Heart');

      const name = await generator.getName({
        defindex: 30177,
        quality: 5,
        effect: 19,
        elevated: true,
      });

      expect(name).toBe('Strange Circling Heart Hong Kong Cone');
    });

    it('will create the name of a normal quality item', async () => {
      schema.getSchemaItemByDefindex.mockReturnValueOnce({
        item_name: 'Minigun',
        proper_name: false,
        item_quality: 0,
      });
      schema.getQualityById.mockReturnValueOnce('Normal');

      const name = await generator.getName({
        defindex: 202,
        quality: 0,
      });

      expect(name).toBe('Normal Minigun');
    });

    it('will create the name of a Red Rock Roscoe Pistol', async () => {
      schema.getSchemaItemByDefindex.mockReturnValueOnce({
        item_name: 'Pistol',
        proper_name: true,
        item_quality: 15,
      });
      schema.getPaintkitById.mockReturnValueOnce('Red Rock Roscoe');

      const name = await generator.getName({
        defindex: 15013,
        quality: 15,
        wear: 1,
        paintkit: 0,
      });

      expect(name).toBe('Red Rock Roscoe Pistol (Factory New)');
    });
  });
});

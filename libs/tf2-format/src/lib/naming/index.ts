import { ItemNamingSchema, RequiredItemAttributes } from '../types';

const KILLSTREAKS = [
  'Killstreak',
  'Specialized Killstreak',
  'Professional Killstreak',
];
const WEAR = [
  'Factory New',
  'Minimal Wear',
  'Field-Tested',
  'Well-Worn',
  'Battle Scarred',
];

export class NameGenerator {
  constructor(private readonly schema: ItemNamingSchema) {}

  async getName(item: RequiredItemAttributes, proper = true): Promise<string> {
    let name = '';

    let schemaItem = this.schema.getItemByDefindex(item.defindex);
    if (schemaItem === undefined) {
      schemaItem = await this.schema.fetchItemByDefindex(item.defindex);
    } else if (schemaItem instanceof Error) {
      throw schemaItem;
    }

    if (item.tradable === false) {
      name += 'Non-Tradable ';
    }

    if (item.craftable === false) {
      name += 'Non-Craftable ';
    }

    if (item.elevated === true) {
      let quality = this.schema.getQualityById(11);
      if (quality === undefined) {
        quality = await this.schema.fetchQualityById(11);
      } else if (quality instanceof Error) {
        throw quality;
      }

      name += quality + ' ';
    }

    if (
      (item.quality === 6 && item.elevated === true) ||
      (item.quality !== 6 && item.quality !== 15 && item.quality !== 5) ||
      (item.quality === 5 && !item.effect) ||
      schemaItem.item_quality === 5
    ) {
      let quality = this.schema.getQualityById(item.quality);
      if (quality === undefined) {
        quality = await this.schema.fetchQualityById(item.quality);
      } else if (quality instanceof Error) {
        throw quality;
      }

      name += quality + ' ';
    }

    if (typeof item.effect === 'number') {
      let effect = this.schema.getEffectById(item.effect);
      if (effect === undefined) {
        effect = await this.schema.fetchEffectById(item.effect);
      } else if (effect instanceof Error) {
        throw effect;
      }

      name += effect + ' ';
    }

    if (item.festivized) {
      name += 'Festivized ';
    }

    if (item.killstreak !== undefined && item.killstreak !== 0) {
      name += KILLSTREAKS[item.killstreak - 1] + ' ';
    }

    if (typeof item.target === 'number') {
      let target = this.schema.getItemByDefindex(item.target);
      if (target === undefined) {
        target = await this.schema.fetchItemByDefindex(item.target);
      } else if (target instanceof Error) {
        throw target;
      }

      name += target.item_name + ' ';
    }

    if (typeof item.outputQuality === 'number' && item.outputQuality !== 6) {
      let quality = this.schema.getQualityById(item.outputQuality);
      if (quality === undefined) {
        quality = await this.schema.fetchQualityById(item.outputQuality);
      } else if (quality instanceof Error) {
        throw quality;
      }

      name += quality + ' ';
    }

    if (typeof item.output === 'number') {
      let output = this.schema.getItemByDefindex(item.output);
      if (output === undefined) {
        output = await this.schema.fetchItemByDefindex(item.output);
      } else if (output instanceof Error) {
        throw output;
      }

      name += output.item_name + ' ';
    }

    if (item.australium) {
      name += 'Australium ';
    }

    if (typeof item.paintkit === 'number') {
      let paintkit = this.schema.getPaintkitById(item.paintkit);
      if (paintkit === undefined) {
        paintkit = await this.schema.fetchPaintkitById(item.paintkit);
      } else if (paintkit instanceof Error) {
        throw paintkit;
      }

      name += paintkit + ' ';
    }

    if (proper === true && name === '' && schemaItem.proper_name === true) {
      name = 'The ';
    }

    name += schemaItem.item_name;

    if (item.wear) {
      name += ' (' + WEAR[item.wear - 1] + ')';
    }

    if (typeof item.crateSeries === 'number') {
      name += ' #' + item.crateSeries;
    }

    return name;
  }
}

import { Parser } from '../parser';
import { InventoryItem, RecipeInput } from '../../types';
import { TF2ParserSchema } from '../../schemas';
import { Attribute, ExtractedTF2APIItem, TF2APIItem } from './types';
import { Attributes } from '../tf2-gc/types';

export class TF2APIParser extends Parser<
  TF2ParserSchema,
  TF2APIItem,
  ExtractedTF2APIItem
> {
  extract(item: TF2APIItem): ExtractedTF2APIItem {
    const attributes = TF2APIParser.getAttributes(item.attributes);

    return {
      assetid: item.id.toString(),
      originalId: item.original_id.toString(),
      defindex: item.defindex,
      quality: item.quality,
      craftable: item.flag_cannot_craft !== true,
      tradable: item.flag_cannot_trade !== true,
      quantity: item.quantity,
      level: item.level,
      elevated: attributes.killEater === true && item.quality !== 11,
      australium: attributes.australium ?? false,
      festivized: attributes.festivized ?? false,
      effect: attributes.effect ?? null,
      wear: attributes.wear ?? null,
      paintkit: attributes.paintkit ?? null,
      primaryPaint: attributes.primaryPaint ?? null,
      secondaryPaint: attributes.secondaryPaint ?? null,
      killstreak: attributes.killstreak ?? 0,
      sheen: attributes.sheen ?? null,
      killstreaker: attributes.killstreaker ?? 0,
      spells: attributes.spells ?? [],
      parts: attributes.parts ?? [],
      inputs: attributes.inputs ?? null,
      output: attributes.output ?? null,
      outputQuality: attributes.outputQuality ?? null,
      target: attributes.target ?? null,
      crateSeries: null,
    };
  }

  static getAttributes(
    attributes: Attribute[] | undefined,
  ): Partial<Attributes> {
    const result: Partial<Attributes> = {};

    if (attributes !== undefined) {
      const parts: number[] = [];
      const spells: [number, number][] = [];
      const inputs: RecipeInput[] = [];

      for (let i = 0; i < attributes.length; i++) {
        const attribute = attributes[i];

        const value = Buffer.allocUnsafe(4);
        if (attribute.float_value !== undefined) {
          value.writeFloatLE(attribute.float_value, 0);
        } else if (typeof attribute.value === 'number') {
          value.writeUInt32LE(attribute.value, 0);
        }

        switch (attribute.defindex) {
          case 142:
            // Paint color for RED/BLU if universal and RED if team color
            result.primaryPaint = value.readFloatLE(0);
            break;
          case 261:
            // Paint color for BLU
            result.secondaryPaint = value.readFloatLE(0);
            break;
          case 214:
          case 294:
          case 494:
            result.killEater = true;
            break;
          case 134:
          case 2041:
            result.effect = value.readFloatLE(0);
            break;
          case 2053:
            result.festivized = value.readFloatLE(0) > 0;
            break;
          case 380:
          case 382:
          case 384:
            parts.push(Math.round(value.readFloatLE(0)));
            break;
          case 1004:
          case 1005:
          case 1006:
          case 1007:
          case 1008:
          case 1009:
            spells.push([attribute.defindex, value.readFloatLE(0)]);
            break;
          case 2000:
          case 2001:
          case 2002:
          case 2003:
          case 2004:
          case 2005:
          case 2006:
          case 2007:
          case 2008:
          case 2009: {
            if (result.inputs === null) {
              result.inputs = [];
            }

            const recipeAttributes = TF2APIParser.getAttributes(
              attribute.attributes,
            );

            if (attribute.is_output === false) {
              const input: RecipeInput = {
                quality: 6,
                quantity: attribute.quantity ?? 0,
              };

              if (attribute.itemdef) {
                input.defindex = attribute.itemdef;
              }

              if (attribute.quality) {
                input.quality = attribute.quality;
              }

              if (recipeAttributes.killstreak) {
                input.killstreak = recipeAttributes.killstreak;
              }

              inputs.push(input);
            } else {
              for (const key in recipeAttributes) {
                result[key] = recipeAttributes[key];
              }

              if (attribute.itemdef) {
                result.output = attribute.itemdef;
              }

              if (attribute.quality) {
                result.outputQuality = attribute.quality;
              }
            }

            break;
          }
          case 2012:
            result.target = value.readFloatLE(0);
            break;
          case 2013:
            result.killstreaker = value.readFloatLE(0);
            result.killstreak = 3;
            break;
          case 2014:
            result.sheen = value.readFloatLE(0);
            result.killstreak =
              (result.killstreak as number | 0) > 2 ? result.killstreak : 2;
            break;
          case 2025:
            result.killstreak = value.readFloatLE(0);
            result.killstreak =
              (result.killstreak as number | 0) > 1 ? result.killstreak : 1;
            break;
          case 2027:
            result.australium = value.readFloatLE(0) > 0;
            break;
          case 725:
            result.wear = Math.round(value.readFloatLE(0) / 0.2);
            break;
          case 834:
            result.paintkit = value.readUInt32LE(0);
            break;
          default:
            break;
        }
      }

      if (spells.length > 0) {
        result.spells = spells;
      }

      if (parts.length > 0) {
        result.parts = parts;
      }

      if (inputs.length > 0) {
        result.inputs = inputs;
      }
    }

    return result;
  }

  async parse(extracted: ExtractedTF2APIItem): Promise<InventoryItem> {
    let schemaItem = this.schema.getItemsGameItemByDefindex(extracted.defindex);
    if (schemaItem === undefined) {
      schemaItem = await this.schema.fetchItemsGameItemByDefindex(
        extracted.defindex,
      );
    } else if (schemaItem instanceof Error) {
      throw schemaItem;
    }

    let paint: number | undefined | null | Error = null;
    if (extracted.primaryPaint) {
      const hex = extracted.primaryPaint.toString(16);
      paint = this.schema.getPaintByColor(hex);
      if (paint === undefined) {
        paint = await this.schema.fetchPaintByColor(hex);
      } else if (paint instanceof Error) {
        throw paint;
      }
    }

    const parts: number[] = [];
    if (extracted.parts.length > 0) {
      for (let i = 0; i < extracted.parts.length; i++) {
        const part = extracted.parts[i];
        let match = this.schema.getStrangePartById(part);
        if (match instanceof Error) {
          throw match;
        } else if (match === undefined) {
          match = await this.schema.fetchStrangePartById(part);
        }

        parts.push(match);
      }
    }

    const parsed: InventoryItem = {
      assetid: extracted.assetid,
      defindex: extracted.defindex,
      quality: extracted.quality,
      craftable: extracted.craftable,
      tradable: extracted.tradable,
      australium: extracted.australium,
      festivized: extracted.festivized,
      effect: extracted.effect,
      wear: extracted.wear,
      paintkit: extracted.paintkit,
      killstreak: extracted.killstreak,
      target: extracted.target,
      output: extracted.output,
      outputQuality: extracted.outputQuality,
      elevated: extracted.elevated,
      crateSeries: extracted.crateSeries,
      paint,
      parts,
      spells: extracted.spells,
      sheen: extracted.sheen,
      killstreaker: extracted.killstreaker,
      inputs: extracted.inputs,
      quantity: extracted.quantity,
    };

    return parsed;
  }
}

export { TF2APIItem, ExtractedTF2APIItem } from './types';

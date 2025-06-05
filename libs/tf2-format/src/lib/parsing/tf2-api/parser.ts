import { InventoryItem, RecipeInput } from '../../types';
import { Context, TF2APIItem } from './types';
import { Attributes, ExtractedTF2Item } from '../tf2/types';
import { TF2Parser } from '../tf2/parser';

export class TF2APIParser extends TF2Parser<TF2APIItem> {
  private extractAttributes(
    attributes: TF2APIItem['attributes'],
  ): Partial<Attributes> {
    const result: Partial<Attributes> = {};

    if (attributes) {
      const inputs: RecipeInput[] = [];

      for (const attribute of attributes) {
        switch (attribute.defindex) {
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
            const recipeAttributes = this.extractAttributes(
              attribute.attributes,
            );

            if (attribute.is_output === false) {
              const quantity = attribute.quantity ?? 1;
              if (quantity < 1) {
                // 0 if it is fulfilled
                continue;
              }

              const input: RecipeInput = {
                quality: 6,
                quantity,
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
          default: {
            const value = Buffer.allocUnsafe(4);
            if (attribute.float_value !== undefined) {
              value.writeFloatLE(attribute.float_value, 0);
            } else if (typeof attribute.value === 'number') {
              value.writeUInt32LE(attribute.value, 0);
            }

            TF2Parser.extractSimpleAttribute(attribute.defindex, value, result);
            break;
          }
        }
      }

      if (inputs.length > 0) {
        result.inputs = inputs;
      }
    }

    return result;
  }

  extract(raw: TF2APIItem): [ExtractedTF2Item, Context] {
    const attributes = this.extractAttributes(raw.attributes);
    return [
      this.createExtractedItem(raw, attributes),
      {
        craftable: raw.flag_cannot_craft !== true,
        tradable: raw.flag_cannot_trade !== true,
      },
    ];
  }

  async parse(
    extracted: ExtractedTF2Item,
    context: Context,
  ): Promise<InventoryItem> {
    let paint: number | undefined | null | Error = null;
    if (extracted.primaryPaint) {
      const hex = extracted.primaryPaint.toString(16);

      if (hex === '1') {
        // Glitched legacy paint
        paint = 5046;
      } else {
        paint = this.schema.getPaintByColor(hex);
        if (paint === undefined) {
          paint = await this.schema.fetchPaintByColor(hex);
        } else if (paint instanceof Error) {
          throw paint;
        }
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

        if (match !== null) {
          parts.push(match);
        }
      }
    }

    return this.createParsedItem(
      extracted,
      parts,
      paint,
      extracted.crateSeries,
      extracted.quantity,
      context.tradable,
      context.craftable,
    );
  }
}

export { TF2APIItem, ExtractedTF2APIItem } from './types';

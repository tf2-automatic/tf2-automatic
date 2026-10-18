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

              // Defindex 0 and quality 0 are valid values
              if (attribute.itemdef !== undefined) {
                input.defindex = attribute.itemdef;
              }

              if (attribute.quality !== undefined) {
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

              if (attribute.itemdef !== undefined) {
                result.output = attribute.itemdef;
              }

              if (attribute.quality !== undefined) {
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
    const paint = await this.getPaint(extracted);
    const parts = await this.getParts(extracted);

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

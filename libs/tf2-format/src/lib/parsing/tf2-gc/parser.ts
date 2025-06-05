import { InventoryItem, ItemsGameItem, RecipeInput } from '../../types';
import { Context, ExtractedTF2GCItem, TF2GCItem } from './types';
import {
  CAttribute_DynamicRecipeComponent,
  DynamicRecipeFlags,
  eEconItemFlags,
  eEconItemOrigin,
  KILLSTREAK_FABRICATORS,
} from './constants';
import protobuf from 'protobufjs/light';
import assert from 'assert';
import { Attributes } from '../tf2/types';
import { TF2Parser } from '../tf2/parser';

enum AttributeTokens {
  'cannot trade' = 153,
  'always tradable' = 195,
  'expiration date' = 302,
  'never craftable' = 449,
  'non economy' = 777,
  'tool target item' = 2012,
  'killstreak effect' = 2013,
  'killstreak idleeffect' = 2014,
  'killstreak tier' = 2025,
}

const PROTO: protobuf.INamespace = {
  nested: {
    CAttribute_DynamicRecipeComponent: {
      fields: {
        defIndex: { type: 'uint32', id: 1 },
        itemQuality: { type: 'uint32', id: 2 },
        componentFlags: { type: 'uint32', id: 3 },
        attributesString: { type: 'string', id: 4 },
        numRequired: { type: 'uint32', id: 5 },
        numFulfilled: { type: 'uint32', id: 6 },
      },
    },
  },
};

const root = protobuf.Root.fromJSON(PROTO);
const recipeComponentType = root.lookupType(
  'CAttribute_DynamicRecipeComponent',
);
const ATTRIBUTE_SEPERATOR = '|\x01\x02\x01\x03|\x01\x02\x01\x03|';

export class TF2GCParser extends TF2Parser<TF2GCItem, Context> {
  extract(item: TF2GCItem): [ExtractedTF2GCItem, Context] {
    const [attributes, defindexes] = this.getAttributes(item);

    return [
      this.createExtractedItem(item, attributes),
      {
        flags: item.flags,
        origin: item.origin,
        attributes: defindexes,
      },
    ];
  }

  private getAttributes(item: TF2GCItem): [Partial<Attributes>, Set<number>] {
    const result: Partial<Attributes> = {};

    const inputs: RecipeInput[] = [];

    const defindexes = new Set<number>();

    for (let i = 0; i < item.attribute.length; i++) {
      const attribute = item.attribute[i];

      defindexes.add(attribute.def_index);

      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      const value = Buffer.from(attribute.value_bytes as any);

      switch (attribute.def_index) {
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
          // Fabricator inputs
          const component = recipeComponentType
            .decode(value)
            .toJSON() as CAttribute_DynamicRecipeComponent;

          component.componentFlags = component.componentFlags ?? 0;

          const attribs = component.attributesString
            ? component.attributesString.split(ATTRIBUTE_SEPERATOR)
            : [];

          const attribsMap: Record<number, number> = {};
          for (let i = 0; i < attribs.length; i += 2) {
            attribsMap[attribs[i]] = parseFloat(attribs[i + 1]);
          }

          const isOutput =
            component.componentFlags & DynamicRecipeFlags.IS_OUTPUT;

          if (!isOutput) {
            const input: RecipeInput = {
              quality: 6,
              quantity:
                (component.numRequired ?? 0) - (component.numFulfilled ?? 0),
            };

            if (
              component.componentFlags & DynamicRecipeFlags.PARAM_ITEM_DEF_SET
            ) {
              assert(component.defIndex !== undefined, 'defIndex is undefined');
              input.defindex = component.defIndex;
            }

            if (
              component.componentFlags & DynamicRecipeFlags.PARAM_QUALITY_SET
            ) {
              assert(
                component.itemQuality !== undefined,
                'itemQuality is undefined',
              );
              input.quality = component.itemQuality;
            }

            if (attribsMap[AttributeTokens['killstreak tier']]) {
              input.killstreak = attribsMap[AttributeTokens['killstreak tier']];
            }

            inputs.push(input);
          } else {
            if (attribsMap[AttributeTokens['tool target item']]) {
              result.target = attribsMap[AttributeTokens['tool target item']];
            }

            if (attribsMap[AttributeTokens['killstreak idleeffect']]) {
              result.sheen =
                attribsMap[AttributeTokens['killstreak idleeffect']];
              result.killstreak = 2;
            }

            if (attribsMap[AttributeTokens['killstreak effect']]) {
              result.killstreaker =
                attribsMap[AttributeTokens['killstreak effect']];
              result.killstreak = 3;
            }

            assert(
              component.itemQuality !== undefined,
              'itemQuality is undefined',
            );
            assert(component.defIndex !== undefined, 'defIndex is undefined');
            result.outputQuality = component.itemQuality;
            result.output = component.defIndex;
          }

          break;
        }
        default:
          TF2Parser.extractSimpleAttribute(attribute.def_index, value, result);
          break;
      }
    }

    const killstreak = KILLSTREAK_FABRICATORS[item.def_index];
    if (killstreak) {
      result.killstreak = killstreak;
    }

    if (inputs.length > 0) {
      result.inputs = inputs;
    }

    return [result, defindexes];
  }

  private static isCraftable(
    schemaItem: ItemsGameItem,
    context: Context,
  ): boolean {
    // Always craftable
    if (
      context.attributes.has(AttributeTokens['always tradable']) ||
      TF2GCParser.hasAttribute('always tradable', schemaItem)
    ) {
      return true;
    }

    // Never craftable
    if (
      context.attributes.has(AttributeTokens['never craftable']) ||
      TF2GCParser.hasAttribute('never craftable', schemaItem)
    ) {
      return false;
    }

    // Temporary item
    if (
      context.attributes.has(AttributeTokens['expiration date']) ||
      TF2GCParser.hasAttribute('expiration date', schemaItem)
    ) {
      return false;
    }

    switch (context.origin) {
      case eEconItemOrigin.kEconItemOrigin_Invalid:
      case eEconItemOrigin.kEconItemOrigin_Foreign:
      case eEconItemOrigin.kEconItemOrigin_StorePromotion:
      case eEconItemOrigin.kEconItemOrigin_SteamWorkshopContribution:
        return false;

      case eEconItemOrigin.kEconItemOrigin_Purchased:
        if (
          (context.flags &
            eEconItemFlags.kEconItemFlag_PurchasedAfterStoreCraftabilityChanges2012) ===
          0
        ) {
          return false;
        }

        if (
          schemaItem.capabilities &&
          schemaItem.capabilities['can_craft_if_purchased'] === '0'
        ) {
          return false;
        }

        break;
    }

    return true;
  }

  private static isTradable(
    schemaItem: ItemsGameItem,
    extracted: ExtractedTF2GCItem,
    context: Context,
  ): boolean {
    if (
      context.attributes.has(AttributeTokens['non economy']) ||
      this.hasAttribute('non economy', schemaItem)
    ) {
      return false;
    }

    if (
      context.attributes.has(AttributeTokens['always tradable']) ||
      this.hasAttribute('always tradable', schemaItem)
    ) {
      return true;
    }

    if (
      context.attributes.has(AttributeTokens['cannot trade']) ||
      this.hasAttribute('cannot trade', schemaItem)
    ) {
      return false;
    }

    switch (context.origin) {
      case eEconItemOrigin.kEconItemOrigin_Invalid:
      case eEconItemOrigin.kEconItemOrigin_Achievement:
      case eEconItemOrigin.kEconItemOrigin_Foreign:
      case eEconItemOrigin.kEconItemOrigin_PreviewItem:
      case eEconItemOrigin.kEconItemOrigin_SteamWorkshopContribution:
        return false;
    }

    if (context.origin === eEconItemOrigin.kEconItemOrigin_PreviewItem) {
      return false;
    }

    if (extracted.quality >= 7 && extracted.quality <= 9) {
      return false;
    }

    if ((context.flags & eEconItemFlags.kEconItemFlag_CannotTrade) !== 0) {
      return false;
    }

    return true;
  }

  private static hasAttribute(
    attribute: keyof typeof AttributeTokens,
    schemaItem: ItemsGameItem,
  ): boolean {
    if (
      schemaItem.attributes &&
      schemaItem.attributes[attribute]?.value === '1'
    ) {
      return true;
    }

    if (schemaItem.static_attrs && schemaItem.static_attrs[attribute] === '1') {
      return true;
    }

    return false;
  }

  async parse(
    extracted: ExtractedTF2GCItem,
    context: Context,
  ): Promise<InventoryItem> {
    let schemaItem = this.schema.getItemsGameItemByDefindex(extracted.defindex);
    if (schemaItem === undefined) {
      schemaItem = await this.schema.fetchItemsGameItemByDefindex(
        extracted.defindex,
      );
    } else if (schemaItem instanceof Error) {
      throw schemaItem;
    }

    let quantity: number | null = extracted.quantity;
    if (
      extracted.quantity !== undefined &&
      schemaItem.attributes &&
      schemaItem.attributes['unlimited quantity']?.value === '1'
    ) {
      quantity = -1;
    }

    let crateSeries: number | null = extracted.crateSeries;
    // TF2 GC may not provide crate series, so we have to manually retrieve it
    if (
      crateSeries === null &&
      schemaItem.static_attrs &&
      schemaItem.static_attrs['set supply crate series'] !== undefined
    ) {
      crateSeries = Number(schemaItem.static_attrs['set supply crate series']);
    }

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
      crateSeries,
      quantity,
      TF2GCParser.isTradable(schemaItem, extracted, context),
      TF2GCParser.isCraftable(schemaItem, context),
    );
  }
}

export { ExtractedTF2GCItem, TF2GCItem } from './types';

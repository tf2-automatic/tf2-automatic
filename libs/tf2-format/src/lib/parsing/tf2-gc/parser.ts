import { Parser } from '../parser';
import { InventoryItem, ItemsGameItem, RecipeInput } from '../../types';
import { TF2ParserSchema } from '../../schemas';
import { Attributes, Context, ExtractedTF2GCItem, TF2GCItem } from './types';
import {
  CAttribute_DynamicRecipeComponent,
  DynamicRecipeFlags,
  eEconItemFlags,
  eEconItemOrigin,
  KILLSTREAK_FABRICATORS,
} from './constants';
import protobuf from 'protobufjs/light';
import assert from 'assert';

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

export class TF2GCParser extends Parser<
  TF2ParserSchema,
  TF2GCItem,
  ExtractedTF2GCItem,
  Context
> {
  extract(item: TF2GCItem) {
    const [attributes, defindexes] = TF2GCParser.getAttributes(item);

    const data: ExtractedTF2GCItem = {
      assetid: item.id,
      originalId: item.original_id,
      defindex: item.def_index,
      quality: item.quality,
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
      killstreaker: attributes.killstreaker ?? null,
      spells: attributes.spells ?? [],
      parts: attributes.parts ?? [],
      inputs: attributes.inputs ?? null,
      output: attributes.output ?? null,
      outputQuality: attributes.outputQuality ?? null,
      target: attributes.target ?? null,
      crateSeries: null,
    };

    const context: Context = {
      flags: item.flags,
      origin: item.origin,
      attributes: defindexes,
    };

    const result: [ExtractedTF2GCItem, Context] = [data, context];

    return result;
  }

  static getAttributes(item: TF2GCItem): [Partial<Attributes>, Set<number>] {
    const result: Partial<Attributes> = {};

    const parts: number[] = [];
    const spells: [number, number][] = [];
    const inputs: RecipeInput[] = [];

    const defindexes = new Set<number>();

    for (let i = 0; i < item.attribute.length; i++) {
      const attribute = item.attribute[i];

      defindexes.add(attribute.def_index);

      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      const value = Buffer.from(attribute.value_bytes as any);

      switch (attribute.def_index) {
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
          spells.push([attribute.def_index, value.readFloatLE(0)]);
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
        case 2012:
          result.target = value.readFloatLE(0);
          break;
        case 2013:
          result.killstreaker = value.readFloatLE(0);
          break;
        case 2014:
          result.sheen = value.readFloatLE(0);
          break;
        case 2025:
          result.killstreak = value.readFloatLE(0);
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

    const killstreak = KILLSTREAK_FABRICATORS[item.def_index];
    if (killstreak) {
      result.killstreak = killstreak;
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
      craftable: TF2GCParser.isCraftable(schemaItem, context),
      tradable: TF2GCParser.isTradable(schemaItem, extracted, context),
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

export { ExtractedTF2GCItem, TF2GCItem } from './types';

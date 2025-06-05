import { TF2ParserSchema } from '../../schemas';
import { InventoryItem, Item } from '../../types';
import { Parser } from '../parser';
import { Context as APIContext, TF2APIItem } from '../tf2-api/types';
import { Context as GCContext, TF2GCItem } from '../tf2-gc/types';
import { Attributes, ExtractedTF2Item } from './types';

export abstract class TF2Parser<
  RawItem extends TF2GCItem | TF2APIItem,
  Context = RawItem extends TF2APIItem ? APIContext : GCContext,
> extends Parser<TF2ParserSchema, RawItem, ExtractedTF2Item, Context> {
  protected createExtractedItem(
    item: RawItem,
    attributes: Partial<Attributes>,
  ): ExtractedTF2Item {
    return {
      assetid: item.id.toString(),
      originalId: item.original_id?.toString() ?? null,
      defindex: (item as TF2GCItem).def_index ?? (item as TF2APIItem).defindex,
      quality: item.quality,
      quantity: attributes.quantity ?? item.quantity,
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
      crateSeries: attributes.crateSeries ?? null,
    };
  }

  protected createParsedItem(
    extracted: ExtractedTF2Item,
    parts: Item['parts'],
    paint: Item['paint'],
    crateSeries: Item['crateSeries'],
    quantity: Item['quantity'],
    tradable: Item['tradable'],
    craftable: Item['craftable'],
  ): InventoryItem {
    return {
      assetid: extracted.assetid,
      defindex: extracted.defindex,
      quality: extracted.quality,
      craftable: craftable,
      tradable: tradable,
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
      crateSeries,
      paint: paint,
      parts: parts,
      spells: extracted.spells,
      sheen: extracted.sheen,
      killstreaker: extracted.killstreaker,
      inputs: extracted.inputs,
      quantity,
    };
  }

  static extractSimpleAttribute(
    defindex: number,
    value: Buffer,
    result: Partial<Attributes>,
  ): void {
    switch (defindex) {
      case 142:
        // Paint color for RED/BLU if universal and RED if team color
        result.primaryPaint = value.readFloatLE(0);
        break;
      case 187:
        result.crateSeries = Math.round(value.readFloatLE(0));
        break;
      case 261:
        // Paint color for BLU
        result.secondaryPaint = value.readFloatLE(0);
        break;
      case 311:
        result.quantity = -1;
        break;
      case 380:
      case 382:
      case 384:
        (result.parts ??= []).push(Math.round(value.readFloatLE(0)));
        break;
      case 214:
      case 294:
      case 494:
        result.killEater = true;
        break;
      case 134:
        result.effect = value.readFloatLE(0);
        break;
      case 2041:
        result.effect = value.readUInt32LE(0);
        break;
      case 2053:
        result.festivized = value.readFloatLE(0) > 0;
        break;
      case 1004:
      case 1005:
      case 1006:
      case 1007:
      case 1008:
      case 1009:
        (result.spells ??= []).push([defindex, value.readFloatLE(0)]);
        break;
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
      case 725: {
        const raw = value.readFloatLE(0);
        result.wear = raw === 0 ? 1 : Math.round(raw / 0.2);
        break;
      }
      case 834:
        result.paintkit = value.readUInt32LE(0);
        break;
      default:
        break;
    }
  }
}

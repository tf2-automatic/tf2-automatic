import { Parser } from '../parser';
import { PossibleInventoryItem, RecipeInput } from '../../types';
import { BptfExtractedItem, BptfItem } from './types';
import { BptfParserSchema } from '../../schemas';
import * as helpers from '../helpers';

export class BptfParser extends Parser<
  BptfParserSchema,
  BptfItem,
  BptfExtractedItem
> {
  extract(raw: BptfItem): BptfExtractedItem {
    if (raw.appid !== 440) {
      throw new Error(
        'Item is not from Team Fortress 2 (appid: ' + raw.appid + ')',
      );
    }

    return {
      assetid: raw.id !== '' ? raw.id : null,
      originalId: raw.originalId !== '' ? raw.originalId : null,
      defindex: raw.defindex,
      quality: raw.quality.id,
      // It is not craftable if the key is missing.
      craftable: raw.craftable ?? false,
      // It is not tradable if the key is missing.
      tradable: raw.tradable ?? false,
      australium: raw.australium ?? false,
      festivized: raw.festivized ?? false,
      effect: raw.particle?.id ?? null,
      wear: raw.wearTier?.id ?? null,
      paintkit: raw.texture?.id ?? null,
      killstreak: raw.killstreakTier ?? 0,
      target: raw.recipe?.targetItem?._source?.defindex ?? null,
      output: raw.recipe?.outputItem?.defindex ?? null,
      outputQuality: raw.recipe?.outputItem?.quality?.id ?? null,
      elevatedQuality: raw.elevatedQuality?.id ?? null,
      crateSeries: raw.crateSeries ?? null,
      paint: raw.paint?.id ?? null,
      parts: raw.strangeParts
        ? raw.strangeParts.map((part) => part.killEater.item.defindex)
        : [],
      spells: raw.spells ? raw.spells.map((spell) => spell.name) : [],
      sheen: raw.sheen?.id ?? null,
      killstreaker: raw.killstreaker?.id ?? null,
      inputs: raw.recipe?.inputItems ?? [],
      quantity: raw.quantity ?? null,
      level: raw.level ?? null,
    };
  }

  async parse(extracted: BptfExtractedItem): Promise<PossibleInventoryItem> {
    let killstreak = extracted.killstreak;
    // Fixes a problem with backpack.tf not returning the killstreak tier of Killstreak Kit Fabricators...
    if (killstreak === 0) {
      if (extracted.killstreaker) {
        killstreak = 3;
      } else if (extracted.sheen) {
        killstreak = 2;
      }
    }

    const spells: number[] = [];
    for (const spell of extracted.spells) {
      const cached = this.schema.getSpellByName(spell);
      if (cached instanceof Error) {
        throw cached;
      } else if (cached !== undefined) {
        spells.push(cached);
        continue;
      }

      const fetched = await this.schema.fetchSpellByName(spell);
      spells.push(fetched);
    }

    const inputs: RecipeInput[] | null = await helpers.parseInputs(
      extracted.inputs,
      this.schema,
    );

    return {
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
      killstreak,
      target: extracted.target,
      output: extracted.output,
      outputQuality: extracted.outputQuality,
      elevated: extracted.elevatedQuality === 11,
      crateSeries: extracted.crateSeries,
      paint: extracted.paint,
      parts: extracted.parts,
      spells,
      sheen: extracted.sheen,
      killstreaker: extracted.killstreaker,
      inputs,
      quantity: extracted.quantity ?? 1,
    };
  }
}

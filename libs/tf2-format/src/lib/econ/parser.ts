import { Parser } from '../parser';
import { InventoryItem } from '../types';
import {
  DescriptionAttributes,
  EconItem,
  ExtractedEconItem,
  TagAttributes,
} from './types';

const TAGS_OF_INTEREST = new Set<string>([
  'Quality',
  'Exterior',
  'Rarity',
  'Type',
]);

const NON_CRAFTABLE_DESCRIPTIONS = {
  '( Not Usable in Crafting )': true,
  '( Not Tradable, Marketable, or Usable in Crafting )': true,
  '( Not Tradable, Marketable, Usable in Crafting, or Gift Wrappable )': true,
};

const WEAR = {
  'Factory New': 1,
  'Minimal Wear': 2,
  'Field-Tested': 3,
  'Well-Worn': 4,
  'Battle Scarred': 5,
};

const KILLSTREAK_FABRICATORS = {
  1: 6527,
  2: 6523,
  3: 6526,
};

/* eslint-disable @typescript-eslint/no-duplicate-enum-values */
enum IdentifiableDescription {
  Skip = 0,
  All = 1,
  // Paints, spells and parts have the same precedence because it has been shown
  // that they may appear in any order.
  Paint = 1,
  Spells = 1,
  Parts = 1,
  Effect = 2,
  Festivized = 3,
  Killstreaker = 4,
  Sheen = 5,
  Killstreak = 6,
  Texture = 7,
  Input = 8,
  Output = 9,
  Target = 10,
  Uses = 11,
  Craftable = 12,
}
/* eslint-enable @typescript-eslint/no-duplicate-enum-values */

/**
 * This is a mapping from the item type to the description that we want to
 * start the description parsing from
 */
enum TypeToIdentifiableDescription {
  // Cosmetics can have many different descriptions so we will check for all
  'Cosmetic' = IdentifiableDescription.All,
  // Taunts may have effects, so we will check for that
  'Taunt 1' = IdentifiableDescription.Effect,
  // Nothing interesting in these items
  'Party Favor' = IdentifiableDescription.Skip,
  'Action' = IdentifiableDescription.Skip,
  // Most craft items do not have descriptions but we will check for craftable
  'Craft Item' = IdentifiableDescription.Craftable,
  // Check for uses on limited use items
  'Festivizer' = IdentifiableDescription.Uses,
  'Tool' = IdentifiableDescription.Uses,
  'Gift' = IdentifiableDescription.Uses,
  'Strange Part' = IdentifiableDescription.Uses,
  'Usable Item' = IdentifiableDescription.Uses,
  'Crate' = IdentifiableDescription.Uses,
  'Unusualifier' = IdentifiableDescription.Output,
  // Start checking for the target
  'Strangifier' = IdentifiableDescription.Target,
  // War paints may have effects
  'War Paint' = IdentifiableDescription.Effect,
  // Start checking for inputs
  'Recipe' = IdentifiableDescription.Input,
  // We know what we should look for in Killstreak Kits
  'Professional Killstreak Kit' = IdentifiableDescription.Killstreaker,
  'Specialized Killstreak Kit' = IdentifiableDescription.Sheen,
  'Killstreak Kit' = IdentifiableDescription.Killstreak,
  // Start by checking for parts on any weapons
  'Primary weapon' = IdentifiableDescription.Parts,
  'Secondary weapon' = IdentifiableDescription.Parts,
  'Melee weapon' = IdentifiableDescription.Parts,
  'Building' = IdentifiableDescription.Parts,
  'Primary PDA' = IdentifiableDescription.Parts,
  'Secondary PDA' = IdentifiableDescription.Parts,
}

const WEAPON_TYPES = new Set([
  'Primary weapon',
  'Secondary weapon',
  'Melee weapon',
  'Building',
  'Primary PDA',
  'Secondary PDA',
]);

export class EconParser extends Parser<EconItem, ExtractedEconItem> {
  extract(item: EconItem): ExtractedEconItem {
    const tags = EconParser.getTagAttributes(item);

    let start: IdentifiableDescription | undefined;

    if (tags.Type !== undefined) {
      start = TypeToIdentifiableDescription[tags.Type];
    } else if (item.type !== '') {
      // If we are missing the type from the tags we can in some cases get it
      // from the type attribute of the item.
      const match = item.type.match(/Level\s\d+\s(.+)/);
      if (match !== null) {
        start = TypeToIdentifiableDescription[match[1]];
      }
    }

    const descriptions = EconParser.getDescriptionAttributes(item, tags, start);

    const raw: ExtractedEconItem = {
      assetid: item.assetid,
      defindex: EconParser.getDefindex(item),
      quality: tags.Quality ?? null,
      elevated: false,
      craftable: descriptions.craftable,
      tradable: item.tradable,
      australium: EconParser.isAustralium(item, tags),
      festivized: descriptions.festivized,
      effect: descriptions.effect,
      wear: tags.Exterior ?? null,
      paint: descriptions.paint,
      killstreak: EconParser.getKillstreak(descriptions),
      sheen: descriptions.sheen,
      killstreaker: descriptions.killstreaker,
      spells: descriptions.spells,
      parts: descriptions.parts,
      paintkit: descriptions.paintkit,
      uses: descriptions.uses,
      input: descriptions.input,
      output: descriptions.output,
      outputQuality: null,
      target: descriptions.target,
    };

    // Clean up the painkit name
    if (raw.paintkit !== null) {
      if (tags.Rarity !== undefined && tags.Exterior !== undefined) {
        // The length is the length of the description minus the length of the
        // grade and wear
        const length =
          item.descriptions[0].value.length -
          (tags.Exterior.length + 3 + tags.Rarity.length + 7);

        // The new paintkit is the old paintkit without the name of the item
        raw.paintkit = raw.paintkit.slice(0, raw.paintkit.length - length - 1);
      } else {
        // Some items with a paintkit does not have a rarity, so we remove
        // the " War Paint" from the paintkit name manually
        const index = raw.paintkit.indexOf(' War Paint');
        if (index !== -1) {
          raw.paintkit = raw.paintkit.slice(0, index);
        }
      }
    }

    // Handle elevated qualities
    if (raw.quality !== 'Strange') {
      const lastChar = item.type.charCodeAt(item.type.length - 1);
      // Check if last char is a number
      if (lastChar >= 48 && lastChar <= 57) {
        let dashIndex = -1;
        let colonIndex = -1;

        // We can skip 2 chars, this is because we know that there is atleast a
        // space before the number
        for (let i = item.type.length - 3; i >= 0; i--) {
          if (item.type.charAt(i) === '-') {
            dashIndex = i;
            break;
          }

          if (item.type.charAt(i) === ':') {
            colonIndex = i;
          }
        }

        if (colonIndex > dashIndex) {
          raw.elevated = true;
        }
      }
    }

    if (raw.output !== null) {
      if (raw.killstreak !== 0) {
        // Handle Killstreak Kit Fabricators
        raw.target = raw.output.slice(
          raw.output.indexOf('Killstreak ') + 11,
          raw.output.lastIndexOf(' Kit'),
        );
        raw.output = 'Kit';
        raw.outputQuality = 'Unique';
      } else if (raw.output.endsWith('Strangifier')) {
        // Handle Strangifier Chemistry Sets
        raw.output = raw.output.slice(0, raw.output.length - 12);
        raw.outputQuality = 'Strange';
      } else if (raw.output.startsWith("Collector's ")) {
        // Handle Collector's Chemistry Sets
        raw.output = raw.output.slice(12);
        raw.outputQuality = "Collector's";
      }
    }

    return raw;
  }

  async parse(raw: ExtractedEconItem): Promise<InventoryItem> {
    if (raw.defindex === null) {
      throw new Error('Defindex is null');
    }

    // TODO: Can probably optimize the fetching of values
    // Maybe start fetching and then await the promises at the end?

    // Get quality from some cache
    let quality =
      raw.quality !== null ? this.schema.getQualityByName(raw.quality) : null;
    if (quality === undefined) {
      // Quality is not in cache, fetch it from the schema
      quality = await this.schema.fetchQualityByName(raw.quality!);
    }

    if (!quality) {
      throw new Error('Quality is undefined');
    }

    let effect =
      raw.effect !== null ? this.schema.getEffectByName(raw.effect) : null;
    if (effect === undefined) {
      effect = await this.schema.fetchEffectByName(raw.effect!);
    }

    let paintkit =
      raw.paintkit !== null ? this.schema.getTextureByName(raw.paintkit) : null;
    if (paintkit === undefined) {
      paintkit = await this.schema.fetchTextureByName(raw.paintkit!);
    }

    let wear = null;
    if (raw.wear !== null) {
      wear = WEAR[raw.wear];
    }

    let target =
      raw.target !== null ? this.schema.getDefindexByName(raw.target) : null;
    if (target === undefined) {
      target = await this.schema.fetchDefindexByName(raw.target!);
    }

    let outputQuality =
      raw.outputQuality !== null
        ? this.schema.getQualityByName(raw.outputQuality)
        : null;
    if (outputQuality === undefined) {
      outputQuality = await this.schema.fetchQualityByName(raw.outputQuality!);
    }

    let output: number | null = null;
    if (raw.output !== null) {
      if (raw.output === 'Kit') {
        output = KILLSTREAK_FABRICATORS[raw.killstreak];
      } else if (output === 'Strangifier') {
        output = 6522;
      }
    }

    const parts: number[] = [];
    for (const part of raw.parts) {
      const cached = this.getPartByNameFromCache(part);
      if (cached) {
        parts.push(cached);
        continue;
      }

      const fetched = await this.fetchPartByName(part);
      if (fetched) {
        parts.push(fetched);
      }
    }

    const spells: number[] = [];
    for (const spell of raw.spells) {
      const cached = this.schema.getSpellByName(spell);
      if (cached) {
        spells.push(cached);
        continue;
      }

      const fetched = await this.schema.fetchSpellByName(spell);
      if (fetched) {
        spells.push(fetched);
      }
    }

    const parsed: InventoryItem = {
      assetid: raw.assetid,
      defindex: raw.defindex,
      quality,
      craftable: raw.craftable,
      tradable: raw.tradable,
      australium: raw.australium,
      festivized: raw.festivized,
      effect,
      wear,
      paintkit,
      killstreak: raw.killstreak,
      sheen: raw.sheen,
      killstreaker: raw.killstreaker,
      target,
      output,
      outputQuality,
      elevated: raw.elevated,
      parts,
      spells,
    };

    return parsed;
  }

  private getPartByNameFromCache(name: string) {
    const any = this.schema.getDefindexByName('Strange Part: ' + name);
    if (any) {
      return any;
    }

    return this.schema.getDefindexByName('Strange Cosmetic Part: ' + name);
  }

  private async fetchPartByName(name: string) {
    const any = await this.schema.fetchDefindexByName('Strange Part: ' + name);
    if (any) {
      return any;
    }

    return this.schema.fetchDefindexByName('Strange Cosmetic Part: ' + name);
  }

  static getDefindex(item: EconItem): number | null {
    for (const action of item.actions) {
      if (action.name !== 'Item Wiki Page...') {
        continue;
      }

      const defindex = new URL(action.link).searchParams.get('id');
      if (defindex === null) {
        return null;
      }

      return parseInt(defindex, 10);
    }

    return null;
  }

  static getKillstreak(descriptions: DescriptionAttributes): number {
    if (descriptions.killstreaker !== null) {
      return 3;
    } else if (descriptions.sheen !== null) {
      return 2;
    } else if (descriptions.killstreak) {
      return 1;
    } else {
      return 0;
    }
  }

  static getTagAttributes(item: EconItem): TagAttributes {
    const tags: Record<string, string> = {};

    let tagCount = 0;
    for (const tag of item.tags) {
      if (TAGS_OF_INTEREST.has(tag.category)) {
        tagCount++;
        tags[tag.category] = tag.name;
        if (tagCount === TAGS_OF_INTEREST.size) {
          break;
        }
      }
    }

    return tags as TagAttributes;
  }

  static isAustralium(item: EconItem, tags: TagAttributes): boolean {
    // It might be possible for australiums to be qualities other than Strange.
    // But I think all australium items are a weapon of some sort.
    if (!WEAPON_TYPES.has(tags.Type ?? '')) {
      return false;
    }

    // All australium items have Australium in their name. Except for "Saxxy",
    // but that item is always australium.
    return item.market_hash_name.includes('Australium ');
  }

  /**
   * This function tries to extract as much useful information as possible from
   * the descriptions of an item.
   * @param item The item to extract the information from
   * @param tags The tags of the item
   * @param start The description to start from
   * @returns An object with the extracted information
   */
  static getDescriptionAttributes(
    item: EconItem,
    tags: TagAttributes,
    start = IdentifiableDescription.Paint,
  ): DescriptionAttributes {
    const attributes: DescriptionAttributes = {
      craftable: true,
      effect: null,
      killstreak: false,
      sheen: null,
      killstreaker: null,
      spells: [],
      parts: [],
      paint: null,
      festivized: false,
      paintkit: null,
      uses: null,
      input: null,
      output: null,
      target: null,
    };

    if (start === IdentifiableDescription.Skip) {
      return attributes;
    }

    let next = start;

    const descriptions = item.descriptions;

    // Add empty description to make sure we do not get out of bounds errors
    descriptions.push({ value: '' });

    let i = 0;

    loop: while (i < descriptions.length - 1) {
      // Skip descriptions that are too short/long to contain any useful information
      // TODO: Fix "magic numbers"
      if (descriptions[i].value.length < 10) {
        i++;
        continue;
      }

      /* eslint-disable no-fallthrough */
      switch (next) {
        case IdentifiableDescription.All:
        case IdentifiableDescription.Paint:
          if (descriptions[i].value.startsWith('Paint Color: ')) {
            attributes.paint = descriptions[i].value.slice(13);
            next = IdentifiableDescription.Spells;
            i++;
          }
        case IdentifiableDescription.Spells:
          if (descriptions[i].value.startsWith('Halloween: ')) {
            attributes.spells.push(
              descriptions[i].value.slice(
                11,
                descriptions[i].value.lastIndexOf(
                  ' (spell only active during event)',
                ),
              ),
            );
            // This is redundant
            next = IdentifiableDescription.Spells;
            i++;
            // We break because that might be the best to do if there are more spells
            continue loop;
          }
        case IdentifiableDescription.Parts:
          if (
            descriptions[i].value.startsWith('(') &&
            // Make sure it does not match Craftable/Tradable/Marketable descriptions
            descriptions[i].value.charAt(1) !== ' '
          ) {
            attributes.parts.push(
              descriptions[i].value.slice(
                1,
                descriptions[i].value.lastIndexOf(': '),
              ),
            );
            next = IdentifiableDescription.Parts;
            i++;
            // Break again so we can check for more parts
            continue loop;
          } else if (descriptions[i].value.startsWith('     ')) {
            attributes.parts.push(
              descriptions[i].value.slice(
                5,
                descriptions[i].value.lastIndexOf(': '),
              ),
            );
            next = IdentifiableDescription.Parts;
            i++;
            // Break again so we can check for more parts
            continue loop;
          }
        case IdentifiableDescription.Effect:
          if (descriptions[i].value.startsWith('\u2605 Unusual Effect: ')) {
            attributes.effect = descriptions[i].value.slice(18);
            next = IdentifiableDescription.Festivized;
            i++;
          }
        case IdentifiableDescription.Festivized:
          if (descriptions[i].value === 'Festivized') {
            attributes.festivized = true;
            next = IdentifiableDescription.Killstreaker;
            i++;
          }
        case IdentifiableDescription.Killstreaker:
          if (descriptions[i].value.startsWith('Killstreaker: ')) {
            attributes.killstreaker = descriptions[i].value.slice(14);
            next = IdentifiableDescription.Sheen;
            i++;
          }
        case IdentifiableDescription.Sheen:
          if (descriptions[i].value.startsWith('Sheen: ')) {
            attributes.sheen = descriptions[i].value.slice(7);
            next = IdentifiableDescription.Killstreak;
            i++;
          }
        case IdentifiableDescription.Killstreak:
          if (descriptions[i].value === 'Killstreaks Active') {
            attributes.killstreak = true;
            next = IdentifiableDescription.Texture;
            i++;
          }
        case IdentifiableDescription.Texture: {
          let extract = false;

          if (descriptions[i].value.endsWith('Collection')) {
            if (tags.Exterior !== undefined) {
              next = IdentifiableDescription.Texture;
              extract = true;
            }
            i++;

            // Might be a little "dangerous" to use these while loops
            while (descriptions[i].value.charAt(0) === ' ') {
              i++;
            }
          }

          let paintkit: string | null = null;
          let found = false;

          if (descriptions[i].value.startsWith('\u2714 ')) {
            paintkit = descriptions[i].value.slice(2);
            found = true;
          } else if (descriptions[i].value.startsWith('\u2605 ')) {
            found = true;

            let test = descriptions[i].value.slice(2);
            if (test.endsWith(' War Paint')) {
              test = test.slice(0, test.length - 10);
            }
            const index = item.name.indexOf(test);

            if (index !== -1) {
              paintkit = test;
            }
          }

          if (found) {
            i++;

            // Skip all the other stuff if any
            while (descriptions[i].value.charAt(0) === ' ') {
              i++;
            }

            if (extract) {
              attributes.paintkit = paintkit;
              next = IdentifiableDescription.Uses;
            }

            // We continue the loop so that we skip to the next checks
            continue loop;
          }
        }
        case IdentifiableDescription.Input:
          if (
            descriptions[i].value ===
            'The following are the inputs that must be fulfilled.'
          ) {
            i++;

            const inputs: { name: string; amount: number }[] = [];
            attributes.input = inputs;

            while (descriptions[i].value !== ' ') {
              const split = descriptions[i].value.lastIndexOf(' x ');
              const name = descriptions[i].value.slice(0, split);

              const amount = parseInt(
                descriptions[i].value.slice(split + 3),
                10,
              );

              inputs.push({ name, amount });
              i++;
            }

            next = IdentifiableDescription.Output;
          }
        case IdentifiableDescription.Output:
          if (
            descriptions[i].value ===
            'You will receive all of the following outputs once all of the inputs are fulfilled.'
          ) {
            i++;

            attributes.output = descriptions[i].value;
            i++;

            if (descriptions[i].value !== ' ') {
              let start = 1;
              if (descriptions[i].value.startsWith('(Killstreaker: ')) {
                start = descriptions[i].value.indexOf(', ');
                attributes.killstreaker = descriptions[i].value.slice(
                  15,
                  start,
                );
                start += 2;
              }

              attributes.sheen = descriptions[i].value.slice(
                start + 7,
                descriptions[i].value.length - 1,
              );
              i++;
            }

            next = IdentifiableDescription.Uses;
          }
        case IdentifiableDescription.Target:
          if (descriptions[i].value.startsWith('This ')) {
            // Can probably speed this up by just slicing strings instead of
            // using regex
            const match = descriptions[i].value.match(
              /^This .*? can be applied to a (.*?)(?=\.)/,
            );

            if (match !== null) {
              attributes.target = match[1];
              next = IdentifiableDescription.Uses;
              i++;
            }
          }
        case IdentifiableDescription.Uses:
          if (
            descriptions[i].value.startsWith(
              'This is a limited use item. Uses: ',
            )
          ) {
            attributes.uses = parseInt(descriptions[i].value.slice(34), 10);
            next = IdentifiableDescription.Craftable;
            i++;
          }
        case IdentifiableDescription.Craftable:
          if (NON_CRAFTABLE_DESCRIPTIONS[descriptions[i].value]) {
            attributes.craftable = false;
            // We found everything we could possibly look for.
            break loop;
          }
        default:
          i++;
          continue loop;
      }
      /* eslint-enable no-fallthrough */
    }

    return attributes;
  }
}

export * from './types';

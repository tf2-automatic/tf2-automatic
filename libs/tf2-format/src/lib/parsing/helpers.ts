import { DefindexByName, QualityByName, SpellByName } from '../schemas';
import { RecipeInput, NumberOrNull, Spell } from '../types';
import { KILLSTREAK_NAMES_TO_TIERS } from '../common';
import { ExtractedRecipeInput } from './econ/types';

export function getInputByName(name: string, schema: DefindexByName) {
  if (name.startsWith('The ')) {
    const input = schema.getDefindexByName(name.slice(4));
    if (input) {
      return input;
    }
  }

  return schema.getDefindexByName(name);
}

export function fetchInputByName(name: string, schema: DefindexByName) {
  if (name.startsWith('The ')) {
    const input = schema.fetchDefindexByName(name.slice(4));
    if (input) {
      return input;
    }
  }

  return schema.fetchDefindexByName(name);
}

export async function getSpellByName(
  extractedSpells: string[],
  schema: SpellByName,
): Promise<Spell[]> {
  const spells: Spell[] = [];
  for (const spell of extractedSpells) {
    const cached = schema.getSpellByName(spell);
    if (cached instanceof Error) {
      throw cached;
    } else if (cached !== undefined) {
      spells.push(cached);
      continue;
    }

    const fetched = await schema.fetchSpellByName(spell);
    spells.push(fetched);
  }

  return spells;
}

export async function parseInputs(
  extractedInputs: ExtractedRecipeInput[] | null,
  schema: QualityByName & DefindexByName,
): Promise<RecipeInput[] | null> {
  let inputs: RecipeInput[] | null = null;
  if (extractedInputs !== null) {
    inputs = [];

    for (const rawInput of extractedInputs) {
      let name: string | null = rawInput.name;
      let rawQuality = 'Unique';
      // Handle strange items for strangifier chemistry sets
      if (name.startsWith('Strange ')) {
        name = name.slice(8);
        rawQuality = 'Strange';
      }

      let quality: NumberOrNull = null;

      // Get the quality
      const cachedQuality = schema.getQualityByName(rawQuality);
      if (cachedQuality === undefined) {
        quality = await schema.fetchQualityByName(rawQuality);
      } else if (cachedQuality instanceof Error) {
        throw cachedQuality;
      } else {
        quality = cachedQuality;
      }

      const input: RecipeInput = {
        quality,
        quantity: rawInput.quantity,
      };

      // Handle killstreak items for killstreak kit fabricators
      if (name.endsWith(' Killstreak Item')) {
        // Backpack.tf does not prefix "Unique", but Steam does...
        const killstreak = name.slice(
          name.startsWith('Unique') ? 7 : 0,
          name.length - 5,
        );
        name = null;
        input.killstreak = KILLSTREAK_NAMES_TO_TIERS[killstreak];
      }
      if (name !== null) {
        // Get the defindex of the input item
        let defindex: number | null = null;

        const cached = getInputByName(name, schema);
        if (cached === undefined) {
          defindex = await fetchInputByName(name, schema);
        } else if (cached instanceof Error) {
          throw cached;
        } else {
          defindex = cached;
        }

        if (defindex === null) {
          throw new Error(
            `Could not find the defindex of the input item "${name}"`,
          );
        }

        input.defindex = defindex;
      }

      inputs.push(input);
    }
  }

  return inputs;
}

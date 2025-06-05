import {
  EconParser,
  ItemsGameItem,
  EconParserSchema,
  Spell,
} from '../../dist/libs/tf2-format';
import { parseEconItem } from 'tf2-item-format/static';
import axios from 'axios';
import DataLoader from 'dataloader';
import Benchmark from 'benchmark';
import fs from 'node:fs';

const itemServiceUrl = process.argv[2];
if (itemServiceUrl === undefined) {
  throw new Error(
    'Missing item-service url argument. Usage: ts-node benchmark.ts <item-service-url>',
  );
}

const cache = new Map();

const itemsGameLoader = new DataLoader<number, ItemsGameItem | null>(
  ([defindex]) => {
    return axios
      .get(itemServiceUrl + '/schema/items/' + defindex, {
        params: {
          items_game: true,
        },
      })
      .then((res) => {
        const result = res.data;
        cache.set('itemsgame:' + defindex, result);
        return [result];
      })
      .catch((err) => {
        if (err.response.status === 404) {
          cache.set('itemsgame:' + defindex, null);
          return [null];
        }

        throw err;
      });
  },
  {
    batch: false,
  },
);

const qualityLoader = new DataLoader<string, number | null>(
  ([quality]) => {
    return axios
      .get(itemServiceUrl + '/schema/qualities/' + quality)
      .then((res) => {
        const result = res.data.id;
        cache.set('quality:' + quality, result);
        return [result];
      });
  },
  {
    batch: false,
  },
);

const effectLoader = new DataLoader<string, number | null>(
  ([effect]) => {
    return axios
      .get(itemServiceUrl + '/schema/effects/' + effect)
      .then((res) => {
        const result = res.data.id;
        cache.set('effect:' + effect, result);
        return [result];
      });
  },
  {
    batch: false,
  },
);

const textureLoader = new DataLoader<string, number | null>(
  ([texture]) => {
    return axios
      .get(itemServiceUrl + '/schema/paintkits/' + texture)
      .then((res) => {
        const result = res.data.id;
        cache.set('texture:' + texture, result);
        return [result];
      });
  },
  {
    batch: false,
  },
);

const itemLoader = new DataLoader<string, number | null>(
  ([item]) => {
    return axios
      .get(itemServiceUrl + '/schema/items/search', {
        params: {
          name: item,
        },
      })
      .then((res) => {
        // Look for upgradable if one is in the list, if not then take the first
        let match = res.data[0];

        for (let i = 0; i < res.data.length; i++) {
          const element = res.data[i];
          if (
            element.name ===
            'Upgradable ' + element.item_class.toUpperCase()
          ) {
            match = element;
            break;
          }
        }

        const result = match.defindex;
        cache.set('item:' + item, result);
        return [result];
      })
      .catch((err) => {
        if (err.response.status === 404) {
          cache.set('item:' + item, null);
          return [null];
        }

        throw err;
      });
  },
  {
    batch: false,
  },
);

const spellLoader = new DataLoader<string, Spell | null>(
  ([spell]) => {
    return axios
      .get('http://localhost:3003/schema/spells/' + spell)
      .then((res) => {
        const result = [res.data.attribute, res.data.value];
        cache.set('spell:' + spell, result);
        return [result];
      });
  },
  {
    batch: false,
  },
);

const partLoader = new DataLoader<string, number | null>(
  ([part]) => {
    return axios
      .get('http://localhost:3003/schema/parts/' + part)
      .then((res) => {
        const result = res.data.defindex;
        cache.set('part:' + part, result);
        return [result];
      })
      .catch((err) => {
        if (err.response.status === 404) {
          cache.set('part:' + part, null);
          return [null];
        }

        throw err;
      });
  },
  {
    batch: false,
  },
);

export const SHEENS = {
  'Team Shine': 1,
  'Deadly Daffodil': 2,
  Manndarin: 3,
  'Mean Green': 4,
  'Agonizing Emerald': 5,
  'Villainous Violet': 6,
  'Hot Rod': 7,
};

export const KILLSTREAKERS = {
  'Fire Horns': 2002,
  'Cerebral Discharge': 2003,
  Tornado: 2004,
  Flames: 2005,
  Singularity: 2006,
  Incinerator: 2007,
  'Hypno-Beam': 2008,
};

const schema: EconParserSchema = {
  getItemsGameItemByDefindex: (defindex) => cache.get('itemsgame:' + defindex),
  fetchItemsGameItemByDefindex: (defindex) => itemsGameLoader.load(defindex),
  getQualityByName: (name) => cache.get('quality:' + name),
  fetchQualityByName: (name) => qualityLoader.load(name),
  getEffectByName: (name) => cache.get('effect:' + name),
  fetchEffectByName: (name) => effectLoader.load(name),
  getTextureByName: (name) => cache.get('texture:' + name),
  fetchTextureByName: (name) => textureLoader.load(name),
  getDefindexByName: (name) => cache.get('item:' + name),
  fetchDefindexByName: (defindex) => itemLoader.load(defindex),
  getSpellByName: (name) => cache.get('spell:' + name),
  fetchSpellByName: (name) => spellLoader.load(name),
  getStrangePartByScoreType: (name) => cache.get('part:' + name),
  fetchStrangePartByScoreType: (name) => partLoader.load(name),
  getSheenByName: (name) => SHEENS[name],
  fetchSheenByName: (name) => Promise.resolve(SHEENS[name]),
  getKillstreakerByName: (name) => KILLSTREAKERS[name],
  fetchKillstreakerByName: (name) => Promise.resolve(KILLSTREAKERS[name]),
};

const parser = new EconParser(schema);

const items = JSON.parse(fs.readFileSync('./econ-data.json', 'utf-8'));

const suite = new Benchmark.Suite({
  initCount: 1,
});

suite
  .add('@tf2-automatic/tf2-format (strings)', () => {
    const parsed = new Array(items.length);

    for (let i = 0; i < items.length; i++) {
      parsed[i] = parser.extract(items[i]);
    }
  })
  .add('tf2-item-format (strings)', () => {
    const parsed = new Array(items.length);

    for (let i = 0; i < items.length; i++) {
      parsed[i] = parseEconItem(items[i], false, false);
    }
  })
  .add('@tf2-automatic/tf2-format (numbers)', async () => {
    const parsed = new Array(items.length);

    for (let i = 0; i < items.length; i++) {
      const extracted = parser.extract(items[i]);
      parsed[i] = parser.parse(extracted);
    }

    await Promise.all(parsed);
  })
  .add('tf2-item-format (numbers)', () => {
    const parsed = new Array(items.length);

    for (let i = 0; i < items.length; i++) {
      parsed[i] = parseEconItem(items[i], true, true);
    }
  })
  .on('cycle', async function (event: Benchmark.Event) {
    console.log(String(event.target));
  })
  .run({ async: true });

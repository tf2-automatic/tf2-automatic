import { EconParser, Schema, StrangePart } from '../../dist/libs/tf2-format';
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
        const result = res.data[0].defindex;
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

const spellLoader = new DataLoader<string, number | null>(
  ([spell]) => {
    return axios
      .get('http://localhost:3003/schema/spells/' + spell)
      .then((res) => {
        const result = res.data.id;
        cache.set('spell:' + spell, result);
        return [result];
      });
  },
  {
    batch: false,
  },
);

const partLoader = new DataLoader<string, StrangePart | null>(
  ([part]) => {
    return axios
      .get('http://localhost:3003/schema/parts/' + part)
      .then((res) => {
        const result = res.data;
        cache.set('part:' + part, result);
        return [result];
      }).catch((err) => {
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

const schema: Schema = {
  getQualityByName: (name) => cache.get('quality:' + name),
  fetchQualityByName: (name) => qualityLoader.load(name),
  getEffectByName: (name) => cache.get('effect:' + name),
  fetchEffectByName: (name) => effectLoader.load(name),
  getTextureByName: (name) => cache.get('texture:' + name),
  fetchTextureByName: (name) => textureLoader.load(name),
  getDefindexByName: (name) => cache.get('item:' + name),
  fetchDefindexByName: (name) => itemLoader.load(name),
  getSpellByName: (name) => cache.get('spell:' + name),
  fetchSpellByName: (name) => spellLoader.load(name),
  getStrangePartByScoreType: (name) => cache.get('part:' + name),
  fetchStrangePartByScoreType: (name) => partLoader.load(name),
};

const parser = new EconParser(schema);

const items = JSON.parse(fs.readFileSync('./data.json', 'utf-8'));

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

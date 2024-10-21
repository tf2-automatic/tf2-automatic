import { EconParser, Schema } from '../../dist/libs/tf2-format';
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
      .get(itemServiceUrl + '/schema/qualities/name/' + quality)
      .then((res) => [res.data.id]);
  },
  {
    batch: false,
    cache: true,
    cacheMap: cache,
    cacheKeyFn: (key) => 'quality:' + key,
  },
);

const effectLoader = new DataLoader<string, number | null>(
  ([effect]) => {
    return axios
      .get(itemServiceUrl + '/schema/effects/name/' + effect)
      .then((res) => [res.data.id]);
  },
  {
    batch: false,
    cache: true,
    cacheMap: cache,
    cacheKeyFn: (key) => 'effect:' + key,
  },
);

const textureLoader = new DataLoader<string, number | null>(
  ([texture]) => {
    return axios
      .get(itemServiceUrl + '/schema/paintkits/name/' + texture)
      .then((res) => [res.data.id]);
  },
  {
    batch: false,
    cache: true,
    cacheMap: cache,
    cacheKeyFn: (key) => 'texture:' + key,
  },
);

const itemLoader = new DataLoader<string, number | null>(
  ([item]) => {
    return axios
      .get(itemServiceUrl + '/schema/items/name/' + item)
      .then((res) => [res.data[0].defindex])
      .catch((err) => {
        if (err.response.status === 404) {
          return [null];
        }

        throw err;
      });
  },
  {
    batch: false,
    cache: true,
    cacheMap: cache,
    cacheKeyFn: (key) => 'item:' + key,
  },
);

const spellLoader = new DataLoader<string, number | null>(
  ([spell]) => {
    return axios
      .get(
        'http://localhost:3003/schema/spells/name/' + spell,
      )
      .then((res) => [res.data.id]);
  },
  {
    batch: false,
    cache: true,
    cacheMap: cache,
    cacheKeyFn: (key) => 'spell:' + key,
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
      parsed[i] = EconParser.prepare(items[i]);
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
      parsed[i] = parser.parse(items[i]);
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

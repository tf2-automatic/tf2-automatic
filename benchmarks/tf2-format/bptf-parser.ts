import { BptfParserSchema, BptfParser } from '../../dist/libs/tf2-format';
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

const schema: BptfParserSchema = {
  getQualityByName: (name) => cache.get('quality:' + name),
  fetchQualityByName: (name) => qualityLoader.load(name),
  getDefindexByName: (name) => cache.get('item:' + name),
  fetchDefindexByName: (defindex) => itemLoader.load(defindex),
  getSpellByName: (name) => cache.get('spell:' + name),
  fetchSpellByName: (name) => spellLoader.load(name),
};

const parser = new BptfParser(schema);

const items = JSON.parse(fs.readFileSync('./bptf-data.json', 'utf-8'));

const suite = new Benchmark.Suite({
  initCount: 1,
});

suite
  .add('@tf2-automatic/tf2-format (extract)', () => {
    const parsed = new Array(items.length);

    for (let i = 0; i < items.length; i++) {
      parsed[i] = parser.extract(items[i]);
    }
  })
  .add('@tf2-automatic/tf2-format (parse)', async () => {
    const parsed = new Array(items.length);

    for (let i = 0; i < items.length; i++) {
      const extracted = parser.extract(items[i]);
      parsed[i] = parser.parse(extracted);
    }

    await Promise.all(parsed);
  })
  .on('cycle', async function (event: Benchmark.Event) {
    console.log(String(event.target));
  })
  .run({ async: true });

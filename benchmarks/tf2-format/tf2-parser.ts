import { ItemsGameItem, TF2Parser, TF2ParserSchema } from '../../dist/libs/tf2-format';
import { BackpackParser } from 'tf2-backpack';
import axios from 'axios';
import DataLoader from 'dataloader';
import Benchmark from 'benchmark';
import fs from 'node:fs';
import { parse } from 'kvparser';

const itemServiceUrl = process.argv[2];
if (itemServiceUrl === undefined) {
  throw new Error(
    'Missing item-service url argument. Usage: ts-node benchmark.ts <item-service-url>',
  );
}

const cache = new Map();

const itemLoader = new DataLoader<number, ItemsGameItem | null>(
  ([defindex]) => {
    return axios
      .get(itemServiceUrl + '/schema/items/' + defindex, {
        params: {
          items_game: true,
        }
      })
      .then((res) => {
        const result = res.data;
        cache.set('item:' + defindex, result);
        return [result];
      })
      .catch((err) => {
        if (err.response.status === 404) {
          cache.set('item:' + defindex, null);
          return [null];
        }

        throw err;
      });
  },
  {
    batch: false,
  },
);

const paintLoader = new DataLoader<string, number | null>(
  ([paint]) => {
    return axios
      .get(itemServiceUrl + '/schema/paints/' + paint)
      .then((res) => {
        const result = res.data.id;
        cache.set('paint:' + paint, result);
        return [result];
      });
  },
  {
    batch: false,
  },
);

const partLoader = new DataLoader<number, number | null>(
  ([part]) => {
    return axios
      .get('http://localhost:3003/schema/parts/' + part)
      .then((res) => {
        const result = res.data.defindex;
        cache.set('part:' + result.id, result);
        return [result.id];
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

export const SHEENS = {
  1: 'Team Shine',
  2: 'Deadly Daffodil',
  3: 'Manndarin',
  4: 'Mean Green',
  5: 'Agonizing Emerald',
  6: 'Villainous Violet',
  7: 'Hot Rod',
};

export const KILLSTREAKERS = {
  2002: 'Fire Horns',
  2003: 'Cerebral Discharge',
  2004: 'Tornado',
  2005: 'Flames',
  2006: 'Singularity',
  2007: 'Incinerator',
  2008: 'Hypno-Beam',
};

export const SPELLS = {
  '1004_0': 8901,
  '1004_1': 8902,
  '1004_2': 8900,
  '1004_3': 8903,
  '1004_4': 8904,
  '1005_1': 8914,
  '1005_2': 8920,
  '1005_8421376': 8915,
  '1005_3100495': 8916,
  '1005_5322826': 8917,
  '1005_13595446': 8918,
  '1005_8208497': 8919,
};

const schema: TF2ParserSchema = {
  getItemByDefindex: (defindex) => cache.get('item:' + defindex),
  fetchItemByDefindex: (defindex) => itemLoader.load(defindex),
  getPaintByColor: (color) => cache.get('paint:' + color),
  fetchPaintByColor: (color) => paintLoader.load(color),
  getSpellById: (defindex, id) => SPELLS[`${defindex}_${id}`],
  fetchSpellById: (defindex, id) => Promise.resolve(SPELLS[`${defindex}_${id}`]),
  getKillstreakerById: (id) => KILLSTREAKERS[id],
  fetchKillstreakerById: (id) => Promise.resolve(KILLSTREAKERS[id]),
  getSheenById: (id) => SHEENS[id],
  fetchSheenById: (id) => Promise.resolve(SHEENS[id]),
  getStrangePartById: (id) => cache.get('part:' + id),
  fetchStrangePartById: (id) => partLoader.load(id),
};

const tf2FormatParser = new TF2Parser(schema);

const items = JSON.parse(fs.readFileSync('./tf2-data.json', 'utf-8'));

const suite = new Benchmark.Suite({
  initCount: 1,
});

(async () => {
  const itemsGame = await axios.get(itemServiceUrl + '/schema/items_game').then((res) => res.data);

  const tf2BackpackParser = new BackpackParser(parse(itemsGame).items_game);

  suite
    .add('@tf2-automatic/tf2-format (extract)', () => {
      const parsed = new Array(items.length);

      for (let i = 0; i < items.length; i++) {
        parsed[i] = tf2FormatParser.extract(items[i]);
      }
    })
    .add('@tf2-automatic/tf2-format (parse)', async () => {
      const parsed = new Array(items.length);

      for (let i = 0; i < items.length; i++) {
        const [extracted, context] = tf2FormatParser.extract(items[i]);
        parsed[i] = tf2FormatParser.parse(extracted, context);
      }

      await Promise.all(parsed);
    })
    .add('tf2-backpack (parse)', () => {
      const parsed = new Array(items.length);

      for (let i = 0; i < items.length; i++) {
        parsed[i] = tf2BackpackParser.parseItem(items[i], false);
      }
    })
    .on('cycle', async function (event: Benchmark.Event) {
      console.log(String(event.target));
    })
    .run({ async: true });
})();
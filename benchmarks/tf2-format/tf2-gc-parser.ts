import {
  ItemsGameItem,
  TF2GCParser,
  TF2ParserSchema,
} from '../../dist/libs/tf2-format';
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
        },
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
    return axios.get(itemServiceUrl + '/schema/paints/' + paint).then((res) => {
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

const schema: TF2ParserSchema = {
  getItemsGameItemByDefindex: (defindex) => cache.get('item:' + defindex),
  fetchItemsGameItemByDefindex: (defindex) => itemLoader.load(defindex),
  getPaintByColor: (color) => cache.get('paint:' + color),
  fetchPaintByColor: (color) => paintLoader.load(color),
  getStrangePartById: (id) => cache.get('part:' + id),
  fetchStrangePartById: (id) => partLoader.load(id),
};

const tf2FormatParser = new TF2GCParser(schema);

const items = JSON.parse(fs.readFileSync('./tf2-data.json', 'utf-8'));

const suite = new Benchmark.Suite({
  initCount: 1,
});

(async () => {
  const itemsGame = await axios
    .get(itemServiceUrl + '/schema/items_game')
    .then((res) => res.data);

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

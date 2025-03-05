import { EconParser, ItemsGameItem, Schema, TF2Parser, TF2ParserSchema } from '../../dist/libs/tf2-format';
import axios from 'axios';
import DataLoader from 'dataloader';
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
        }
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
          if (element.name === 'Upgradeable ' + element.item_class.toUpperCase()) {
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

const partLoader = new DataLoader<string | number, number | null>(
  ([part]) => {
    return axios
      .get('http://localhost:3003/schema/parts/' + part)
      .then((res) => {
        const result = res.data.defindex;
        cache.set('part:id:' + result.id, result);
        cache.set('part:name:' + result.name, result);
        return [result];
      }).catch((err) => {
        if (err.response.status === 404) {
          if (typeof part === 'string') {
            cache.set('part:name:' + part, null);
          } else {
            cache.set('part:id:' + part, null);
          }
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
        const result = res.data.defindex;
        cache.set('paint:' + paint, result);
        return [result];
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

const tf2Schema: TF2ParserSchema = {
  getItemByDefindex: (defindex) => cache.get('itemsgame:' + defindex),
  fetchItemByDefindex: (defindex) => itemsGameLoader.load(defindex),
  getPaintByColor: (color) => cache.get('paint:' + color),
  fetchPaintByColor: (color) => paintLoader.load(color),
  getSpellById: (defindex, id) => SPELLS[`${defindex}_${id}`],
  fetchSpellById: (defindex, id) => Promise.resolve(SPELLS[`${defindex}_${id}`]),
  getKillstreakerById: (id) => KILLSTREAKERS[id],
  fetchKillstreakerById: (id) => Promise.resolve(KILLSTREAKERS[id]),
  getSheenById: (id) => SHEENS[id],
  fetchSheenById: (id) => Promise.resolve(SHEENS[id]),
  getStrangePartById: (id) => cache.get('part:id:' + id),
  fetchStrangePartById: (id) => partLoader.load(id),
};

const schema: Schema = {
  getItemByDefindex: (defindex) => cache.get('itemsgame:' + defindex),
  fetchItemByDefindex: (defindex) => itemsGameLoader.load(defindex),
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
  getStrangePartByScoreType: (name) => cache.get('part:name:' + name),
  fetchStrangePartByScoreType: (name) => partLoader.load(name),
};

const econParser = new EconParser(schema);
const tf2Parser = new TF2Parser(tf2Schema);

const econItems = JSON.parse(fs.readFileSync('./econ-xd-data.json', 'utf-8'));
const tf2Items = JSON.parse(fs.readFileSync('./tf2-data.json', 'utf-8'));

// Create map of the items

const items = {};

for (const item of econItems) {
  items[item.assetid] = items[item.defindex] ?? {};

  items[item.assetid] = {
    econ: item,
  };
}

for (const item of tf2Items) {
  items[item.id] = items[item.id] ?? {};

  items[item.id] = {
    ...items[item.id],
    tf2: item,
  };
}

(async () => {
  for (const item in items) {
    const econExtracted = econParser.extract(items[item].econ);
    const econParsed = await econParser.parse(econExtracted);

    const [tf2Extracted, tf2ExtractedContext] = tf2Parser.extract(items[item].tf2);
    const tf2Parsed = await tf2Parser.parse(tf2Extracted, tf2ExtractedContext);

    const equal = JSON.stringify(econParsed) === JSON.stringify(tf2Parsed);

    if (!equal) {
      console.log("Not equal");
      console.log(econParsed);
      console.log(tf2Parsed);
      break;  
    }
  }
})();

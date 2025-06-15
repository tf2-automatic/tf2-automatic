import {
  EconParser,
  EconParserSchema,
  ItemsGameItem,
  Spell,
  TF2APIParser,
  TF2ParserSchema,
} from '../../dist/libs/tf2-format';
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
            'Upgradeable ' + element.item_class.toUpperCase()
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

const partLoader = new DataLoader<string | number, number | null>(
  ([part]) => {
    return axios
      .get('http://localhost:3003/schema/parts/' + part)
      .then((res) => {
        const result = res.data.defindex;
        cache.set('part:id:' + result.id, result);
        cache.set('part:name:' + result.name, result);
        return [result];
      })
      .catch((err) => {
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
    return axios.get(itemServiceUrl + '/schema/paints/' + paint).then((res) => {
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

const tf2Schema: TF2ParserSchema = {
  getItemsGameItemByDefindex: (defindex) => cache.get('itemsgame:' + defindex),
  fetchItemsGameItemByDefindex: (defindex) => itemsGameLoader.load(defindex),
  getPaintByColor: (color) => cache.get('paint:' + color),
  fetchPaintByColor: (color) => paintLoader.load(color),
  getStrangePartById: (id) => cache.get('part:id:' + id),
  fetchStrangePartById: (id) => partLoader.load(id),
};

const econSchema: EconParserSchema = {
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
  getStrangePartByScoreType: (name) => cache.get('part:name:' + name),
  fetchStrangePartByScoreType: (name) => partLoader.load(name),
  getSheenByName: (name) => SHEENS[name],
  fetchSheenByName: (name) => Promise.resolve(SHEENS[name]),
  getKillstreakerByName: (name) => KILLSTREAKERS[name],
  fetchKillstreakerByName: (name) => Promise.resolve(KILLSTREAKERS[name]),
};

const econParser = new EconParser(econSchema);
const tf2Parser = new TF2APIParser(tf2Schema);

const econItems = JSON.parse(
  fs.readFileSync('./econ-edgecases-data.json', 'utf-8'),
);
const tf2Items = JSON.parse(fs.readFileSync('./tf2-api-data.json', 'utf-8'));

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
    if (!items[item].econ || !items[item].tf2) {
      console.log(items[item]);
      throw new Error('Missing item');
    }

    const [econExtracted, context] = econParser.extract(items[item].econ);
    const econParsed = await econParser.parse(econExtracted, context);

    const [tf2Extracted, tf2ExtractedContext] = tf2Parser.extract(
      items[item].tf2,
    );

    const tf2Parsed = await tf2Parser.parse(tf2Extracted, tf2ExtractedContext);

    if (tf2Extracted.primaryPaint === 1) {
      // Glitched legacy paint, just ignore it
      tf2Parsed.paint = null;
    }

    if (econParsed.paintkit !== null || econParsed.wear !== null) {
      if (
        (econParsed.elevated || econParsed.quality === 11) &&
        (tf2Parsed.elevated || tf2Parsed.quality === 11)
      ) {
        econParsed.quality = -1;
        econParsed.elevated = false;
        tf2Parsed.quality = -1;
        tf2Parsed.elevated = false;
      } else if (
        (econParsed.quality === 5 || econParsed.effect !== null) &&
        (tf2Parsed.quality === 5 || tf2Parsed.effect !== null)
      ) {
        econParsed.quality = 5;
        tf2Parsed.quality = 5;
      }
    }

    const equal = JSON.stringify(econParsed) === JSON.stringify(tf2Parsed);

    if (!equal) {
      console.log('Not equal');
      console.log(econParsed);
      console.log(tf2Parsed);
      break;
    }
  }
})();

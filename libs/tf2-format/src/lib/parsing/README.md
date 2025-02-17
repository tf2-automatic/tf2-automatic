# Item parsers

The parsers are used to parse Team Fortress 2 items into a common format. It is designed to accurately parse items as quickly as possible while not having to store the entire TF2 schema in-memory. Minimal hard-coding is used to ensure that schema changes does not break the parsing. The library is well suitable for distributed environments where a centralized schema registry is used, such as the [@tf2-automatic/item-service](../../../../../apps/item-service/).

## Usage

See the example below:

```ts
import { EconParser, Schema, EconItem, ExtractedEconItem, Item } from '@tf2-automatic/tf2-format';

// Define getters for various schema values
const schema: Schema = {
  getQualityByName: (name) => 0,
  fetchQualityByName: (name) => Promise.resolve(0),
  getEffectByName: (name) => 0,
  fetchEffectByName: (name) => Promise.resolve(0),
  getTextureByName: (name) => 0,
  fetchTextureByName: (name) => Promise.resolve(0),
  getDefindexByName: (name) => 0,
  fetchDefindexByName: (name) => Promise.resolve(0),
  getSpellByName: (name) => 0,
  fetchSpellByName: (name) => Promise.resolve(0),
  getStrangePartByScoreType: (name) => { defindex: 0, name: '' },
  fetchStrangePartByScoreType: (name) => Promise.resolve({ defindex: 0, name: '' }),
};

const parser = new EconParser(schema);

const econItem: EconItem = {
  // ...
};

// 1. Very fast but only extracts values as strings.
const extracted: ExtractedEconItem = parser.extract(econitem);

// 2. Not as fast but converts the values to ids based on the schema.
const item: Item = await parser.parse(raw);
```

Parsing can be accomplished in two ways. Method 1 is designed to be fast, extracting raw values from the econ item as strings. Method 2 builds on this by converting the values into IDs using the provided schema.

The schema must be provided to the parser and consists of various getter methods to retrieve the necessary information for parsing items. Each value has two getters: a synchronous method and an asynchronous method. The synchronous "get" method is designed to be fast and requires the user to implement an in-memory hashmap or a similar data-structure. In contrast, the asynchronous "fetch" method retrieves schema values from external sources, such as a common schema registry, and is relatively slower than the "get" method.

## Configuration

An example of how to implement the schema is given below:

```ts
import { Schema } from '@tf2-automatic/tf2-format';
import axios from 'axios';

const cache = new Map<string, number>();

// Define getters for various schema values
const schema: Schema = {
  getQualityByName: (name) => cache.get('quality:' + name),
  fetchQualityByName: (name) => {
    return axios.get('http://localhost:3000/schema/qualities/' + name).then((response) => {
      const result = response.data.id;

      // Save the value in the cache
      cache.set('quality:' + result);

      return result;
    });
  },
  getEffectByName: (name) => 0,
  fetchEffectByName: (name) => Promise.resolve(0),
  getTextureByName: (name) => 0,
  fetchTextureByName: (name) => Promise.resolve(0),
  getDefindexByName: (name) => 0,
  fetchDefindexByName: (name) => Promise.resolve(0),
  getSpellByName: (name) => 0,
  fetchSpellByName: (name) => Promise.resolve(0),
  getStrangePartByScoreType: (name) => { defindex: 0, name: '' },
  fetchStrangePartByScoreType: (name) => Promise.resolve({ defindex: 0, name: '' }),
};
```

The example above gets the quality from the [@tf2-automatic/item-service](../../../../../apps/item-service/). If the "get" method returns undefined, then the "fetch" method is used. Once the fetch method has retrieved the value, it is then cached. Each of the methods will at max be called once when parsing a single item.

## Advanced usage

For the best results with using the parser, the following points should be considered.

### Optimizations

It is strongly recommended that a cache is used to store the fetched values. More cache hits results in better performance. The cache can grow quite large but it would never get close to the size of the [TF2 schema](https://wiki.teamfortress.com/wiki/Item_schema) because only names and ids are used.

To get the best performance, the [dataloader](https://github.com/graphql/dataloader) library should be used for fetching. This ensures that multiple fetches to the same key reuses the same promise result. Dataloader can also be used to cache values, and it supports batching which would in theory reduce the latency. But this is only relevant when the cache has not been populated.

### Cache invalidation

Consistency is important when parsing items. If multiple processes are parsing items and have their own local in-memory cache, then you might get different results when the schema changes and the caches have outdated values. While the risk of this is small, it should still be considered. To protect against this you should clear the cache when the schema changes, or you should use a TTL cache. Using a TTL cache is not recommended, because the schema rarely changes and it would impact performance negatively. Because caching is not handled by the library, it is something you need to implement yourself.

## Benchmarks

This library has been benchmarked against [node-tf2-item-format](https://github.com/danocmx/node-tf2-item-format) version [5.9.21](https://github.com/danocmx/node-tf2-item-format/releases/tag/v5.9.21). The benchmarks ran on a AMD Ryzen 9 7950x with 2x16GB DDR5-6000 CL30-38-38-96. The items used for the benchmark was from a high-valued inventory of 3090 items which took up 5.9MB on disk.

```
@tf2-automatic/tf2-format (strings) x 67.55 ops/sec ±12.51% (33 runs sampled)
tf2-item-format (strings) x 5.55 ops/sec ±1.27% (18 runs sampled)
@tf2-automatic/tf2-format (numbers) x 26.68 ops/sec ±2.77% (48 runs sampled)
tf2-item-format (numbers) x 2.42 ops/sec ±1.50% (10 runs sampled)
```

The string format uses the shallow parsing which only extracts the raw values from the item. The number format uses the schema to convert the raw values into ids.

The benchmark can be found [here](../../../../../benchmarks/tf2-format/).

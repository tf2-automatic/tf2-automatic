# tf2-format

This is a fast, stateless, and extensible library for working with Team Fortress 2 item formats. It uses a single, unified schema, to convert item data across different formats. It is designed for speed, reliability, and interoperability - it has no hardcoded values, no internal state, and doesn't assume where your data comes from. It makes working with TF2 items simple, efficient, and dependable.

The library is well suitable for distributed environments where a centralized schema registry is used, such as [@tf2-automatic/item-service](../../apps/item-service).

## Why another library?

I created this library because I needed fast, simple, and reliable handling of different formats in Team Fortress 2. While there are many existing solutions, most suffer from the same core issues: they are slow, rely heavily on hard-coded logic, assume all data is stored in memory, and don't integrate well with each other due to incompatible formats or edge cases.

This library addresses those problems with a different approach: it is stateless, modular, and built around a shared, extensible schema. Instead of hardcoding logic or assuming all data is available locally and upfront, it delegates data access to the user through a clean interface. Additionally, this library is designed to avoid blocking Node.js's main event loop with heavy synchronous tasks.

The design is guided by the following principles:

- **Consistency**: Eliminates ambiguity by enforcing a single schema across formats.
- **Speed**: Significantly faster than alternatives while remaining accurate.
- **Interoperability**: Easy to convert between different formats.
- **Reliability**: Avoids reliance on hard-coded edge cases; all logic is explicit and predictable.
- **Statelessness**: The library does not store, cache, or batch data. It leaves full control of data flow to the user.

These principles ensure the library is simple to use and is something you can rely on.

## Getting started

The library can be installed from [npm](https://www.npmjs.com/package/@tf2-automatic/tf2-format) using the following command:

```$ npm install @tf2-automatic/tf2-format```

### Example

Once installed, you can implement a schema to parse TF2 items, as shown in the example below.

```ts
import {
  TF2ParserSchema,
  TF2APIParser,
  TF2APIItem,
  SKU,
  Item,
  InventoryItem,
  ItemsGameItem,
} from '@tf2-automatic/tf2-format';

// Example stores mapping keys to values

const items: Record<string, ItemsGameItem> = {
  // Mann Co. Supply Crate Key (defindex as string key)
  '5021': {
    name: 'Decoder Ring',
    attributes: {
      'always tradable': {
        attribute_class: 'always_tradable',
        value: '1',
      },
    },
    static_attrs: {
      'is commodity': '1',
    },
  },
};

const paint: Record<string, number> = {
  'e7b53b': 5037, // Australium Gold
  'b8383b': 5046, // Team Spirit (RED team hex color)
};

const parts: Record<string, number | null> = {
  '87': 6060, // Strange Part: Headshot Kills (87 is the kill eater id)
};

// Define the schema for the parser
const schema: TF2ParserSchema = {
  getItemsGameItemByDefindex: (defindex) => items[String(defindex)],
  fetchItemsGameItemByDefindex: (defindex) => Promise.resolve(items[String(defindex)]),
  getPaintByColor: (color) => paint[color],
  fetchPaintByColor: (color) => Promise.resolve(paint[color]),
  getStrangePartById: (id) => parts[id],
  fetchStrangePartById: (id) => Promise.resolve(parts[id]),
};

// Create a parser instance with the schema
const parser = new TF2APIParser(schema);

// Example TF2 API item (fill with actual data)
const item: TF2APIItem = { /* ... */ };

// Extract information without using the schema
const [extracted, context] = parser.extract(item);

// Parse the extracted data into common format using the schema
const parsed: InventoryItem = await parser.parse(extracted, context);

// Convert parsed item into string
const sku: string = SKU.fromObject(parsed);

// Convert string back into common format
const object: Item = SKU.fromString(sku);
```

This example demonstrates how to define a schema, create a parser using that schema, and convert between item formats and SKUs.

## Main concepts

This library is organized into different classes and types, each made for working with specific formats. By separating functionality this way, you can easily work with the format you need without unnecessary complexity.

### Schemas

Schemas define common methods for retrieving external information about TF2 items during parsing. The library **does not** store, cache, or batch any data and maintains **no internal state**. All data access must be implemented externally by the user through the schema methods, allowing flexible integration with any data source - whether it is in-memory, file-based, remote APIs, or databases.

Information retrieval is organized into distinct **subschemas**, each being responsible for specific schema information. Each subschema provides:

- A synchronous `get` method for fast, local lookups.
- An asynchronous `fetch` method for retrieving data from external sources.

This design prioritizes speed and memory efficiency by leveraging quick local access while supporting on-demand external data retrieval.

### Item parsing

The item parsers are primarily focused on parsing inventory items from various sources, but it can also be used to parse items from backpack.tf listings.

There are a total of four item parsers:

- [EconParser](./src/lib/parsing/econ) for parsing [Steam economy](https://github.com/DoctorMcKay/node-steam-tradeoffer-manager/wiki/EconItem) items (inventories and trade offers).
- [TF2GCParser](./src/lib/parsing/tf2-gc) for parsing items from the [node-tf2](https://github.com/DoctorMckay/node-tf2) library.
- [TF2APIParser](./src/lib/parsing/tf2-api) for parsing items from the [GetPlayerItems API](https://wiki.teamfortress.com/wiki/WebAPI/GetPlayerItems).
- [BptfParser](./src/lib/parsing/bptf) for parsing items from [backpack.tf](https://next.backpack.tf/developer) listings.

You can read more about the item parsers [here](./src/lib/parsing/).

### SKU

A TF2 SKU is a human-readable string that uniquely identifies an item. It can greatly simplify code by encoding key properties into a compact format and are commonly used by trading bots and APIs.

You can read more about working with SKUs [here](./src/lib/sku).

### Generating names

You can generate names of items using the common format. The names closely matches the in-game item naming and is useful for displaying information in a user-friendly way.

You can read more about generating the name of items [here](./src/lib/naming).

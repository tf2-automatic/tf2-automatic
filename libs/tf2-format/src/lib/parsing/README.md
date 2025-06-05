# Item parsers

## Recommendations

For the best results with using the parser, the following points should be considered.

### Optimizations

It is strongly recommended that a cache is used to store the fetched values. More cache hits results in better performance. The cache can grow quite large but it would never get close to the size of the [TF2 schema](https://wiki.teamfortress.com/wiki/Item_schema) because only names and ids are used.

To get the best performance, the [dataloader](https://github.com/graphql/dataloader) library should be used for fetching. This ensures that multiple fetches to the same key reuses the same promise result. Dataloader can also be used to cache values, and it supports batching which would in theory reduce the latency. But this is only relevant when the cache has not been populated.

### Cache invalidation

Consistency is important when parsing items. If multiple processes are parsing items and have their own local in-memory cache, then you might get different results when the schema changes and the caches have outdated values. While the risk of this is small, it should still be considered.

There are two ways to protect agains this. One way is to keep track of multiple versions of your external schema, and create a new parser for each version.

Another approach is to simply clear the cache when the external schema changes. It is not recommended to use a TTL cache, because the external schema rarely changes, and it would impact performance negatively to fetch the same data multiple times.

## Benchmarks

This library has been benchmarked against [node-tf2-item-format](https://github.com/danocmx/node-tf2-item-format) version [5.9.27](https://github.com/danocmx/node-tf2-item-format/releases/tag/v5.9.27) and [node-tf2-backpack](https://github.com/ZeusJunior/node-tf2-backpack) version [1.2.2](https://github.com/ZeusJunior/node-tf2-backpack/releases/tag/v1.2.2). The benchmarks ran on a AMD Ryzen 9 7950x with 4x16GB DDR5-6000 CL30-38-38-96 running Ubuntu 24.04 with kernel 6.11.0.

The benchmark can be found [here](../../../../../benchmarks/tf2-format/).

### Econ parser

The items used for the benchmark was from a high-valued inventory of 3090 items which took up 5.9MB on disk.

```
@tf2-automatic/tf2-format (strings) x 502 ops/sec ±26.18% (20 runs sampled)
tf2-item-format (strings) x 51.72 ops/sec ±1.47% (68 runs sampled)
@tf2-automatic/tf2-format (numbers) x 173 ops/sec ±2.86% (67 runs sampled)
tf2-item-format (numbers) x 30.37 ops/sec ±1.36% (54 runs sampled)
```

It is able to parse **~530.000 items per second**, 5x more than the fastest alternative.

### TF2 GC parser

The items used for the benchmark is an inventory of only 184 items which took up 137KB on disk.

```
@tf2-automatic/tf2-format (extract) x 36,695 ops/sec ±1.15% (96 runs sampled)
@tf2-automatic/tf2-format (parse) x 3,332 ops/sec ±3.22% (84 runs sampled)
tf2-backpack (parse) x 425 ops/sec ±1.34% (90 runs sampled)
```

It is able to parse **~610.000 items per second**, 8x more than the fastest alternative.

### TF2 API parser

The items used for the benchmark is an inventory of 4131 items which took up 6.7MB on disk.

```
@tf2-automatic/tf2-format (extract) x 221 ops/sec ±3.05% (76 runs sampled)
@tf2-automatic/tf2-format (parse) x 82.78 ops/sec ±2.72% (74 runs sampled)
```

It is able to parse **~340.000 items per second**.

### Backpack.tf parser

The items used for the benchmark were retrieved from the backpack.tf websocket server and consists of 1000 random items which took up 925KB on disk.

```
@tf2-automatic/tf2-format (extract) x 2,385 ops/sec ±0.87% (95 runs sampled)
@tf2-automatic/tf2-format (parse) x 363 ops/sec ±3.14% (79 runs sampled)
```

It is able to parse **~360.000 items per second**.

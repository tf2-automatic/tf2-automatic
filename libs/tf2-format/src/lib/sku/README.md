# SKUs

SKUs are used to create a string representation of a TF2 item. The SKU format was first seen used by [marketplace.tf](https://marketplace.tf), and was later adobted by [prices.tf](https://prices.tf) and used in [tf2autobot](https://github.com/tf2autobot/tf2autobot). There are other libraries for parsing SKUs, but they are incredibly slow compared to this library.

## Usage

See the example below:

```ts
import { SKU, PrimaryItemAttributes } from '@tf2-automatic/tf2-format';
import assert from 'assert';

// A Mann Co. Supply Crate Key represented as a string
const sku = '5021;6';

// Parse the string into the common item representation
const item: PrimaryItemAttributes = SKU.fromString(sku);

// Or create the string representation again
assert(sku === SKU.fromObject(item));
```

The `fromString` method is incredibly fast. With even the shortest valid strings it is more than 3 times as fast as alternatives. And the performance benefit is even more noticable at the longer the strings are, with as high as 5 times better performance.

No validations are made by the `SKU` class. But this is not a problem because the `fromString` method properly handles any string inputs. This makes it perfectly fine to use the method to parse user inputs. Additionally, the different parts of the SKU does not need to be in any specific order. The attributes can be in any order and it would not affect the parsing performance.

## Benchmarks

This library has been benchmarked against [node-tf2-item-format](https://github.com/danocmx/node-tf2-item-format) version [5.9.21](https://github.com/danocmx/node-tf2-item-format/releases/tag/v5.9.21) and [@tf2autobot/node-tf2-sku](https://github.com/tf2autobot/node-tf2-sku) version [2.0.4](https://github.com/TF2Autobot/node-tf2-sku/releases/tag/v2.0.4). The benchmarks ran on a AMD Ryzen 9 7950x with 2x16GB DDR5-6000 CL30-38-38-96.

```
@tf2-automatic/tf2-format (short) x 40,827,265 ops/sec ±1.45% (96 runs sampled)
tf2-item-format (short) x 12,373,981 ops/sec ±1.09% (96 runs sampled)
@tf2autobot/tf2-sku (short) x 978,569 ops/sec ±1.43% (91 runs sampled)
@tf2-automatic/tf2-format (long) x 15,141,405 ops/sec ±1.93% (96 runs sampled)
tf2-item-format (long) x 3,628,330 ops/sec ±1.12% (96 runs sampled)
@tf2autobot/tf2-sku (long) x 776,522 ops/sec ±1.42% (95 runs sampled)
```

The string `5021;6` was used in the benchmarks using short strings, which is a Mann Co. Supply Crate Key. For the benchmarks with the longer string, the string `205;11;u702;w5;pk279;kt-3` was used, which is an item with the name Strange Professional Killstreak Isotope Frozen Aurora Rocket Launcher (Battle Scarred).

The benchmark can be found [here](../../../../../benchmarks/tf2-format/).

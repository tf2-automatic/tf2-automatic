# tf2-format

Benchmarks for comparing the [@tf2-automatic/tf2-format](../../libs/tf2-format/) library against other libraries.

## Prerequisites

These are some common steps that you need to do to run any of the benchmarks:

1. Build the tf2-format library by first installing the project dependencies using `pnpm install` in the root of the repository and then run `pnpm nx build tf2-format` to build the tf2-format library.
2. Navigate to this directory and install the dependencies for the benchmark using `pnpm install`.

Individual benchmarks might have additional prerequisites.

## Item parsers

To run the Econ parser or TF2 parser benchmarks, use the following command `pnpm ts-node <econ/tf2>-parser.ts <item-service-url>` where you replace `<item-service-url>` with the base url to item-service (e.g `http://localhost:3000`).

You also need to create a file called `<econ/tf2>-items.json` with the econ or tf2 items for the benchmark.

There are some things to consider with the benchmark:

- node-tf2-item-format uses a separate schema, but if you use the newest version of [node-tf2-static-schema](https://github.com/danocmx/node-tf2-static-schema) and also have the newest version stored in the item-service, then it is comparable.
- The outputs of the different libraries are not the same, but they are comparable.
- The performance of the tf2-format library depends on the event loop because it uses promises. The benchmark is the best-case performance for the given list of items.
- The cache becomes populated by the initial sample. This means that the results do not consider the time to fetch the schema values from the item-service.

## SKU parser

This benchmark compares the SKU parsing performance of [@tf2autobot/tf2-sku](https://github.com/tf2autobot/node-tf2-sku) and [tf2-item-format](https://github.com/danocmx/node-tf2-item-format).

Run the benchmark using `pnpm ts-node sku.ts`.

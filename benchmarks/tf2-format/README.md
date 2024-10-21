# Benchmarks

Benchmark for comparing the [@tf2-automatic/tf2-format](../../libs/tf2-format/) parser against the [node-tf2-item-format](https://github.com/danocmx/node-tf2-item-format) parser.

## Usage

0. Set up [@tf2-automatic/item-service](../../apps/item-service/) and make sure the schema has been loaded.
1. Build the tf2-format library by first installing the project dependencies using `pnpm install` in the root of the repository and then run `pnpm nx build tf2-format` to build the tf2-format library.
2. Navigate to this directory and install the dependencies for the benchmark using `pnpm install`.
3. Obtain a list of econ items and save them as JSON to a file called `items.json` inside this directory.
4. Run the benchmarks using `pnpm ts-node benchmark.ts <item-service-url>` where you replace `<item-service-url>` with the base url to item-service (e.g `http://localhost:3000`).

## Caveats

There are some things to consider with these benchmarks:

- node-tf2-item-format uses a separate schema, but if you use the newest version of [node-tf2-static-schema](https://github.com/danocmx/node-tf2-static-schema) and also have the newest version stored in the item-service, then it is comparable.
- The outputs of the different libraries are not the same, but they are comparable.
- The performance of the tf2-format library depends on the event loop because it uses promises. The benchmark is the best-case performance for the given list of items.
- The cache becomes populated by the initial sample. This means that the results do not consider the time to fetch the schema values from the item-service.

import { SKU } from '../../dist/libs/tf2-format';
import SKU2 from '@tf2autobot/tf2-sku';
import { parseSKU } from 'tf2-item-format/static';
import Benchmark from 'benchmark';

const suite = new Benchmark.Suite({
  initCount: 0,
});

const long = '16310;15;u703;w2;pk310';
const short = '5021;6';

suite
  .add('@tf2-automatic/tf2-format (short)', () => {
    SKU.fromString(short);
  })
  .add('tf2-item-format (short)', () => {
    parseSKU(short);
  })
  .add('@tf2autobot/tf2-sku (short)', () => {
    SKU2.fromString(short);
  })
  .add('@tf2-automatic/tf2-format (long)', () => {
    SKU.fromString(long);
  })
  .add('tf2-item-format (long)', () => {
    parseSKU(long);
  })
  .add('@tf2autobot/tf2-sku (long)', () => {
    SKU2.fromString(long);
  })
  .on('cycle', async function (event: Benchmark.Event) {
    console.log(String(event.target));
  })
  .run({ async: true });

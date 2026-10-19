import { createMemoryRedis } from './memory-redis.mock';

describe('createMemoryRedis', () => {
  it('prefixes keys but not KEYS patterns, like ioredis', async () => {
    const { redis } = createMemoryRedis('prefix:');

    redis.hmset('a:1', { field: Buffer.from('value') });

    expect(await redis.exists('a:1')).toBe(1);
    expect(await redis.keys('a:*')).toEqual([]);
    expect(await redis.keys('prefix:a:*')).toEqual(['prefix:a:1']);
  });

  it('sets field/value pairs and reads them back with hmgetBuffer', async () => {
    const { redis } = createMemoryRedis();
    const value = Buffer.from('value');

    redis.hmset('a', 'field', value);

    expect(await redis.hmgetBuffer('a', 'field', 'missing')).toEqual([
      value,
      null,
    ]);
  });
});

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

  it('stores strings with set and removes them with del', async () => {
    const { redis, strings } = createMemoryRedis('prefix:');
    const value = Buffer.from('value');

    redis.set('a', value);

    expect(await redis.getBuffer('a')).toBe(value);
    expect(strings.has('prefix:a')).toBe(true);
    expect(await redis.getBuffer('missing')).toBeNull();

    redis.del('a');

    expect(await redis.getBuffer('a')).toBeNull();
  });

  it('reads whole hashes and reports ttl like ioredis', async () => {
    const { redis } = createMemoryRedis();
    const value = Buffer.from('value');

    redis.hset('a', { field: value });

    expect(await redis.hgetallBuffer('a')).toEqual({ field: value });
    expect(await redis.hgetallBuffer('missing')).toEqual({});
    expect(await redis.ttl('a')).toBe(-1);
    expect(await redis.ttl('missing')).toBe(-2);
  });
});

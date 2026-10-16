import { createMemoryRedis } from './memory-redis.mock';

describe('createMemoryRedis', () => {
  it('prefixes keys but not KEYS patterns, like ioredis', async () => {
    const { redis } = createMemoryRedis('prefix:');

    redis.hmset('a:1', { field: Buffer.from('value') });

    expect(await redis.exists('a:1')).toBe(1);
    expect(await redis.keys('a:*')).toEqual([]);
    expect(await redis.keys('prefix:a:*')).toEqual(['prefix:a:1']);
  });
});

import { RedisService } from '@liaoliaots/nestjs-redis';
import { HttpService } from '@nestjs/axios';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Listing } from '@tf2-automatic/bptf-manager-data';
import { pack, unpack } from 'msgpackr';
import SteamID from 'steamid';
import { DesiredListing } from './classes/desired-listing.class';
import { CurrentListingsService } from './current-listings.service';
import { ListingLimitsService } from './listing-limits.service';

jest.mock('bullmq', () => ({
  ...jest.requireActual('bullmq'),
  FlowProducer: jest.fn(),
}));

describe('CurrentListingsService', () => {
  const steamid = new SteamID('76561198120070906');

  it('saves updated listings to current listings', async () => {
    const current: Listing = {
      id: 'L1',
      currencies: { keys: 1 },
      item: {},
      archived: false,
      listedAt: 0,
      bumpedAt: 0,
    };

    const redis = {
      hmgetBuffer: jest.fn().mockResolvedValue([pack(current)]),
      hmset: jest.fn(),
    };

    const service = new CurrentListingsService(
      { getOrThrow: () => redis } as unknown as RedisService,
      {} as HttpService,
      { emitAsync: jest.fn() } as unknown as EventEmitter2,
      {} as ListingLimitsService,
      {} as never,
    );

    // Private methods that call backpack.tf / write temporary listings
    const internals = service as unknown as {
      _updateListings: () => Promise<unknown>;
      saveTempListings: () => Promise<void>;
    };
    jest.spyOn(internals, '_updateListings').mockResolvedValue({
      updated: [{ ...current, currencies: { keys: 2 } }],
      errors: [],
    });
    jest.spyOn(internals, 'saveTempListings').mockResolvedValue(undefined);

    const desired = new DesiredListing(
      steamid,
      { id: '1', currencies: { keys: 2 } },
      0,
    ).setID('L1');

    await service.updateListings(
      { steamid64: steamid.getSteamID64(), value: 'token' },
      [desired],
    );

    expect(redis.hmset).toHaveBeenCalledTimes(1);
    const [key, saved] = redis.hmset.mock.calls[0];
    expect(key).toBe('listings:current:' + steamid.getSteamID64());
    expect(unpack(saved['L1'])).toEqual({
      ...current,
      currencies: { keys: 2 },
    });
  });

  describe('refreshing listings', () => {
    const listing = (id: string): Listing => ({
      id,
      currencies: { keys: 1 },
      item: {},
      archived: false,
      listedAt: 0,
      bumpedAt: 0,
    });

    const prefix = 'tf2-automatic:bptf-manager:data:';

    // Minimal in-memory Redis with the commands used by the refresh flow.
    // Like ioredis with a keyPrefix, keys are prefixed except KEYS patterns.
    function createRedis() {
      const hashes = new Map<string, Map<string, Buffer>>();
      const sets = new Map<string, Set<string>>();

      const commands = {
        hmset: (key: string, values: Record<string, Buffer>) => {
          const hash = hashes.get(prefix + key) ?? new Map();
          Object.entries(values).forEach(([field, value]) =>
            hash.set(field, value),
          );
          hashes.set(prefix + key, hash);
        },
        hdel: (key: string, ...fields: string[]) => {
          fields.forEach((field) => hashes.get(prefix + key)?.delete(field));
        },
        expire: () => undefined,
        persist: () => undefined,
        sadd: (key: string, member: string) => {
          sets.set(
            prefix + key,
            (sets.get(prefix + key) ?? new Set()).add(member),
          );
        },
        srem: (key: string, member: string) => {
          sets.get(prefix + key)?.delete(member);
        },
        copy: (source: string, destination: string) => {
          hashes.set(
            prefix + destination,
            new Map(hashes.get(prefix + source)),
          );
        },
        del: (key: string) => {
          hashes.delete(prefix + key);
        },
      };

      const redis = {
        ...commands,
        keys: async (pattern: string) => {
          const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
          return Array.from(hashes.keys()).filter((key) => regex.test(key));
        },
        smembers: async (key: string) =>
          Array.from(sets.get(prefix + key) ?? []),
        exists: async (key: string) => (hashes.has(prefix + key) ? 1 : 0),
        multi: () => {
          const queued: (() => void)[] = [];
          const transaction = {
            exec: async () => queued.forEach((command) => command()),
          };
          Object.entries(commands).forEach(([name, command]) => {
            transaction[name] = (...args: never[]) => {
              queued.push(() => (command as (...a: never[]) => void)(...args));
              return transaction;
            };
          });
          return transaction;
        },
      };

      return { redis, hashes };
    }

    it('keeps listings created and deleted while refreshing', async () => {
      const { redis, hashes } = createRedis();

      const service = new CurrentListingsService(
        { getOrThrow: () => redis } as unknown as RedisService,
        {} as HttpService,
        { emitAsync: jest.fn() } as unknown as EventEmitter2,
        {
          saveLimits: jest.fn(),
          getLimits: jest.fn(),
        } as unknown as ListingLimitsService,
        {} as never,
      );

      const internals = service as unknown as {
        saveTempListings: (
          steamid: SteamID,
          listings: Record<string, Buffer>,
        ) => Promise<void>;
        deleteTempListings: (steamid: SteamID, ids: string[]) => Promise<void>;
      };

      const start = 1000;
      const job = {
        name: 'active',
        data: { steamid64: steamid.getSteamID64(), start },
      } as never;

      // First page of the refresh was fetched before L3 was created
      await service.handleListingsResponse(job, {
        results: [listing('L1'), listing('L2')],
        cursor: { skip: 0, limit: 100, total: 2 },
      } as never);

      // Created and deleted while the refresh is running
      await internals.saveTempListings(steamid, { L3: pack(listing('L3')) });
      await internals.deleteTempListings(steamid, ['L2']);

      await service.handleListingsFetched(steamid, start);

      const current = hashes.get(
        prefix + 'listings:current:' + steamid.getSteamID64(),
      );
      expect(Array.from(current?.keys() ?? []).sort()).toEqual(['L1', 'L3']);
    });

    it('does not recreate an expired temp key', async () => {
      const { redis, hashes } = createRedis();

      const service = new CurrentListingsService(
        { getOrThrow: () => redis } as unknown as RedisService,
        {} as HttpService,
        { emitAsync: jest.fn() } as unknown as EventEmitter2,
        { saveLimits: jest.fn() } as unknown as ListingLimitsService,
        {} as never,
      );

      const internals = service as unknown as {
        saveTempListings: (
          steamid: SteamID,
          listings: Record<string, Buffer>,
        ) => Promise<void>;
      };

      const start = 1000;
      const tempKey =
        'listings:current:' + steamid.getSteamID64() + ':' + start;

      await service.handleListingsResponse(
        {
          name: 'active',
          data: { steamid64: steamid.getSteamID64(), start },
        } as never,
        {
          results: [listing('L1')],
          cursor: { skip: 0, limit: 100, total: 1 },
        } as never,
      );

      // The temp key expired but is still tracked
      hashes.delete(prefix + tempKey);

      await internals.saveTempListings(steamid, { L2: pack(listing('L2')) });

      expect(hashes.has(prefix + tempKey)).toBe(false);
    });
  });
});

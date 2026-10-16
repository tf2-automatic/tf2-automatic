import { RedisService } from '@liaoliaots/nestjs-redis';
import { HttpService } from '@nestjs/axios';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Listing } from '@tf2-automatic/bptf-manager-data';
import { pack, unpack } from 'msgpackr';
import SteamID from 'steamid';
import { DesiredListing } from './classes/desired-listing.class';
import { CurrentListingsService } from './current-listings.service';
import { ListingLimitsService } from './listing-limits.service';
import { mock } from '@tf2-automatic/testing';

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
    const start = 1000;
    const tempKey = 'listings:current:' + steamid.getSteamID64() + ':' + start;

    const job = {
      name: 'active',
      data: { steamid64: steamid.getSteamID64(), start },
    } as never;

    // Starts a refresh at `start` on an in-memory Redis
    async function startRefresh() {
      const { redis, hashes } = mock.createMemoryRedis(prefix);

      const service = new CurrentListingsService(
        { getOrThrow: () => redis } as unknown as RedisService,
        {} as HttpService,
        { emitAsync: jest.fn() } as unknown as EventEmitter2,
        { saveLimits: jest.fn() } as unknown as ListingLimitsService,
        {} as never,
      );

      const internals = service as unknown as {
        producer: { add: jest.Mock };
        saveTempListings: (
          steamid: SteamID,
          listings: Record<string, Buffer>,
        ) => Promise<void>;
        deleteTempListings: (steamid: SteamID, ids: string[]) => Promise<void>;
      };
      internals.producer = { add: jest.fn() };

      const now = jest.spyOn(Date, 'now').mockReturnValue(start);
      await service.refreshListings(steamid);
      now.mockRestore();

      return { service, internals, hashes };
    }

    it('keeps listings created and deleted while refreshing', async () => {
      const { service, internals, hashes } = await startRefresh();

      // Created and deleted before the page, which still has L2 and lacks L3
      await internals.saveTempListings(steamid, { L3: pack(listing('L3')) });
      await internals.deleteTempListings(steamid, ['L2']);

      await service.handleListingsResponse(job, {
        results: [listing('L1'), listing('L2')],
        cursor: { skip: 0, limit: 100, total: 2 },
      } as never);

      await service.handleListingsFetched(steamid, start);

      const current = hashes.get(
        prefix + 'listings:current:' + steamid.getSteamID64(),
      );
      expect(Array.from(current?.keys() ?? []).sort()).toEqual(['L1', 'L3']);
    });

    it('does not recreate an expired temp key', async () => {
      const { internals, hashes } = await startRefresh();

      // The temp key expired but is still tracked
      hashes.delete(prefix + tempKey);

      await internals.saveTempListings(steamid, { L1: pack(listing('L1')) });

      expect(hashes.has(prefix + tempKey)).toBe(false);
    });
  });
});

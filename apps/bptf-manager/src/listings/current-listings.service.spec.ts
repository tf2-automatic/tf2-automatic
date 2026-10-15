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
});

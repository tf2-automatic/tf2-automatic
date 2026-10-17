import { RedisService } from '@liaoliaots/nestjs-redis';
import { Listing, ListingError } from '@tf2-automatic/bptf-manager-data';
import SteamID from 'steamid';
import { AgentsService } from '../agents/agents.service';
import { InventoriesService } from '../inventories/inventories.service';
import { DesiredListing } from './classes/desired-listing.class';
import { CurrentListingsService } from './current-listings.service';
import { DesiredListingsService } from './desired-listings.service';
import { ListingLimitsService } from './listing-limits.service';
import { ManageListingsService } from './manage-listings.service';

const steamid = new SteamID('76561198120070906');

function makeTransaction() {
  const transaction = {
    srem: jest.fn(() => transaction),
    sadd: jest.fn(() => transaction),
    zadd: jest.fn(() => transaction),
    zrem: jest.fn(() => transaction),
    exec: jest.fn(() => Promise.resolve([])),
  };
  return transaction;
}

function makeListing(id: string): Listing {
  return {
    id,
    currencies: { keys: 1 },
    item: {},
    archived: false,
    listedAt: 0,
    bumpedAt: 0,
  };
}

function setup() {
  const transaction = makeTransaction();
  const redis = {
    multi: jest.fn(() => transaction),
    copy: jest.fn(),
    zmscore: jest.fn(),
    zrem: jest.fn(),
    zrange: jest.fn(),
    del: jest.fn(),
    set: jest.fn(),
  };

  const agentsService = { getAgent: jest.fn().mockResolvedValue({}) };
  const desiredListingsService = {
    getAllDesired: jest.fn().mockResolvedValue([]),
    updateDesired: jest.fn().mockResolvedValue([]),
  };
  const currentListingsService = {
    getAllCurrent: jest.fn().mockResolvedValue([]),
    getListingsByIds: jest.fn().mockResolvedValue(new Map()),
    getCurrentShouldNotDeleteEntryKey: jest.fn(() => 'should-not-delete'),
  };
  const listingLimitsService = {
    getLimits: jest.fn(),
  };
  const inventoriesService = {
    getInventory: jest.fn().mockResolvedValue(null),
  };
  const queue = { add: jest.fn() };

  const service = new ManageListingsService(
    { getOrThrow: () => redis } as unknown as RedisService,
    agentsService as unknown as AgentsService,
    desiredListingsService as unknown as DesiredListingsService,
    currentListingsService as unknown as CurrentListingsService,
    listingLimitsService as unknown as ListingLimitsService,
    inventoriesService as unknown as InventoriesService,
    queue as never,
  );

  return {
    service,
    redis,
    transaction,
    desiredListingsService,
    currentListingsService,
    listingLimitsService,
  };
}

describe('ManageListingsService', () => {
  describe('getListingsToCreate', () => {
    it('only takes new listings for the free listing slots', async () => {
      const { service, redis, listingLimitsService } = setup();
      listingLimitsService.getLimits.mockResolvedValue({ cap: 10, used: 8 });
      redis.zrange.mockResolvedValue(['a', 'b']);

      const hashes = await service.getListingsToCreate(steamid, 5);

      expect(redis.zrange).toHaveBeenCalledWith(
        'listings:create:' + steamid.getSteamID64() + ':copy',
        0,
        1,
      );
      expect(hashes).toEqual(['a', 'b']);
    });

    it('removes a leftover copy before copying the create queue', async () => {
      const { service, redis, listingLimitsService } = setup();
      listingLimitsService.getLimits.mockResolvedValue({ cap: 10, used: 10 });

      await service.getListingsToCreate(steamid, 5);

      const copyKey = 'listings:create:' + steamid.getSteamID64() + ':copy';
      expect(redis.del).toHaveBeenCalledWith(copyKey);
      expect(redis.del.mock.invocationCallOrder[0]).toBeLessThan(
        redis.copy.mock.invocationCallOrder[0],
      );
    });

    it('takes no new listings when the cap is reached', async () => {
      const { service, redis, listingLimitsService } = setup();
      listingLimitsService.getLimits.mockResolvedValue({ cap: 10, used: 10 });

      const hashes = await service.getListingsToCreate(steamid, 5);

      expect(redis.zrange).not.toHaveBeenCalled();
      expect(hashes).toEqual([]);
    });
  });

  describe('created desired listings', () => {
    it('removes the created listings from the delete queues', async () => {
      const { service, transaction } = setup();

      const desired = new DesiredListing(
        steamid,
        { id: '1', currencies: { keys: 1 } },
        0,
      ).setID('L1');

      // Private event handler for desired-listings.created
      const handler = service as unknown as {
        createdDesired: (event: unknown) => Promise<void>;
      };
      await handler.createdDesired({ steamid, desired: [desired] });

      expect(transaction.srem).toHaveBeenCalledWith(
        'listings:delete:' + steamid.getSteamID64(),
        'L1',
      );
      expect(transaction.srem).toHaveBeenCalledWith(
        'listings:delete:archived:' + steamid.getSteamID64(),
        'L1',
      );
      expect(transaction.exec).toHaveBeenCalledTimes(1);
    });
  });

  describe('removed desired listings', () => {
    it('are removed from the update queue', async () => {
      const { service, redis, transaction, desiredListingsService } = setup();
      const updateKey = 'listings:update:' + steamid.getSteamID64();

      const desired = new DesiredListing(
        steamid,
        { id: '1', currencies: { keys: 1 } },
        0,
      );

      // Private event handler for desired-listings.removed
      const handler = service as unknown as {
        removedDesired: (event: unknown) => Promise<void>;
      };
      await handler.removedDesired({ steamid, desired: [desired] });

      expect(transaction.zrem).toHaveBeenCalledWith(
        updateKey,
        desired.getHash(),
      );

      // An update job that only finds removed listings drops their hashes
      Object.assign(desiredListingsService, {
        getDesiredByHashes: jest.fn().mockResolvedValue(new Map()),
      });
      await service.updateListings(
        { steamid64: steamid.getSteamID64(), value: 'token' },
        ['stale'],
      );

      expect(redis.zrem).toHaveBeenCalledWith(updateKey, 'stale');
    });
  });

  describe('planListings', () => {
    it('keeps the listing for one desired listing per duplicate set', async () => {
      const {
        service,
        transaction,
        desiredListingsService,
        currentListingsService,
      } = setup();

      const first = new DesiredListing(
        steamid,
        { id: '1', currencies: { keys: 1 } },
        0,
      ).setID('L1');
      const second = new DesiredListing(
        steamid,
        { id: '2', currencies: { keys: 1 } },
        0,
      ).setID('L1');

      currentListingsService.getAllCurrent.mockResolvedValue([
        makeListing('L1'),
      ]);
      desiredListingsService.getAllDesired.mockResolvedValue([first, second]);

      await service.planListings(steamid);

      // The listing is not deleted
      expect(transaction.sadd).not.toHaveBeenCalled();

      // Only the second desired listing is marked as a duplicate
      expect(desiredListingsService.updateDesired).toHaveBeenCalledWith(
        steamid,
        [second.getHash()],
        expect.any(Function),
      );

      const stored = new DesiredListing(
        steamid,
        { id: '2', currencies: { keys: 1 } },
        0,
      ).setID('L1');
      const mutate = desiredListingsService.updateDesired.mock.calls[0][2];
      mutate([stored]);

      expect(stored.getID()).toBeNull();
      expect(stored.getError()).toBe(ListingError.DuplicateListing);
    });
  });
});

describe('ManageListingsService.describeQueued', () => {
  it('only mentions what changes', () => {
    expect(ManageListingsService.describeQueued(0, 0, 0)).toBe(
      'Queued no listing changes',
    );
    expect(ManageListingsService.describeQueued(10, 2, 0)).toBe(
      'Queued 10 to be created, 2 to be updated',
    );
    expect(ManageListingsService.describeQueued(0, 0, 1)).toBe(
      'Queued 1 to be deleted',
    );
  });
});

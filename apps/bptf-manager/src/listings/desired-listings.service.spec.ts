import { Test, TestingModule } from '@nestjs/testing';
import { DesiredListingsService } from './desired-listings.service';
import {
  AddListingDto,
  DesiredListingDto,
  RemoveListingDto,
} from '@tf2-automatic/bptf-manager-data';
import SteamID from 'steamid';
import { getRedisToken } from '@songkeys/nestjs-redis';
import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter';
import { ChainableCommander } from 'ioredis';
import { DesiredListing } from './classes/desired-listing.class';
import { DesiredListing as DesiredListingInterface } from '@tf2-automatic/bptf-manager-data';
import hashListing from './utils/desired-listing-hash';
import { mock } from '@tf2-automatic/testing';
import { AddDesiredListing } from './classes/add-desired-listing.class';
import { pack } from 'msgpackr';

jest.mock('eventemitter2');
jest.mock('redlock', () => jest.fn().mockImplementation(() => mock.redlock));

describe('DesiredListingsService', () => {
  let service: DesiredListingsService;
  let mockEventEmitter: EventEmitter2;
  const mockRedis = mock.redis;

  jest.spyOn(Date, 'now').mockReturnValue(0);

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DesiredListingsService,
        {
          provide: getRedisToken('default'),
          useValue: mockRedis,
        },
      ],
      imports: [EventEmitterModule.forRoot()],
    }).compile();

    service = module.get<DesiredListingsService>(DesiredListingsService);
    mockEventEmitter = module.get<EventEmitter2>(EventEmitter2);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Adding desired', () => {
    it('should add new desired listing', async () => {
      const desired: DesiredListingDto[] = [
        {
          listing: {
            id: '1234',
            currencies: {
              keys: 1,
            },
          },
        },
      ];

      const steamid = new SteamID('76561198120070906');

      jest
        .spyOn(DesiredListingsService.prototype, 'getDesiredByHashes')
        .mockResolvedValue(new Map());

      const result = await service.addDesired(steamid, desired);

      expectMockUsing(
        steamid,
        desired.map((d) => hashListing(d.listing)),
      );

      const hash = hashListing(desired[0].listing);

      const saved: DesiredListingInterface = {
        hash,
        id: null,
        steamid64: steamid.getSteamID64(),
        listing: desired[0].listing,
        updatedAt: 0,
      };

      expect(saved.steamid64).toEqual(steamid.getSteamID64());

      expect(mockRedis.hset).toHaveBeenCalledTimes(1);
      expect(mockRedis.hset).toHaveBeenCalledWith(
        'listings:desired:' + steamid.getSteamID64(),
        hash,
        pack(saved),
      );
      expect(mockRedis.exec).toHaveBeenCalledTimes(1);

      const expectedDesired = new AddDesiredListing(
        steamid,
        desired[0].listing,
        0,
      );

      expect(result).toEqual([expectedDesired]);

      expect(mockEventEmitter.emit).toHaveBeenCalledTimes(1);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'desired-listings.added',
        {
          steamid,
          desired: [expectedDesired],
        },
      );
    });

    it('should "do nothing" when matching existing desired listing', async () => {
      const listing: AddListingDto = {
        id: '1234',
        currencies: {
          keys: 1,
        },
      };

      const desired: DesiredListingDto[] = [
        {
          listing,
        },
      ];

      const steamid = new SteamID('76561198120070906');

      const existingDesired = new DesiredListing(steamid, listing, 0);

      existingDesired.setID('1234');

      jest
        .spyOn(DesiredListingsService.prototype, 'getDesiredByHashes')
        .mockResolvedValue(
          new Map([[existingDesired.getHash(), existingDesired]]),
        );

      const result = await service.addDesired(steamid, desired);

      expectMockUsing(steamid, [existingDesired.getHash()]);

      // Reusing it because it is the exact same because no changes were made
      const saved: DesiredListingInterface = existingDesired.toJSON();

      expect(saved.steamid64).toEqual(steamid.getSteamID64());

      expect(mockRedis.hset).toHaveBeenCalledTimes(1);
      expect(mockRedis.hset).toHaveBeenCalledWith(
        'listings:desired:' + saved.steamid64,
        saved.hash,
        pack(saved),
      );
      expect(mockRedis.exec).toHaveBeenCalledTimes(1);

      const expectedDesired = new AddDesiredListing(steamid, listing, 0).setID(
        existingDesired.getID(),
      );

      expect(result).toEqual([expectedDesired]);

      expect(mockEventEmitter.emitAsync).toHaveBeenCalledTimes(0);
    });

    it('should add desired using existing desired listing', async () => {
      const desired: DesiredListingDto[] = [
        {
          listing: {
            id: '1234',
            currencies: {
              keys: 2,
            },
          },
        },
      ];

      const steamid = new SteamID('76561198120070906');

      const existingListing = {
        id: '1234',
        currencies: {
          keys: 1,
        },
      };

      const existingDesired = new DesiredListing(steamid, existingListing, 0);

      existingDesired.setID('1234');

      jest
        .spyOn(DesiredListingsService.prototype, 'getDesiredByHashes')
        .mockResolvedValue(
          new Map([[existingDesired.getHash(), existingDesired]]),
        );

      const result = await service.addDesired(steamid, desired);

      expectMockUsing(steamid, [hashListing(desired[0].listing)]);

      const saved: DesiredListingInterface = {
        hash: hashListing(desired[0].listing),
        id: existingDesired.getID(),
        steamid64: existingDesired.getSteamID().getSteamID64(),
        listing: desired[0].listing,
        updatedAt: 0,
      };

      expect(saved.steamid64).toEqual(steamid.getSteamID64());

      expect(mockRedis.hset).toHaveBeenCalledTimes(1);
      expect(mockRedis.hset).toHaveBeenCalledWith(
        'listings:desired:' + saved.steamid64,
        saved.hash,
        pack(saved),
      );
      expect(mockRedis.exec).toHaveBeenCalledTimes(1);

      const expectedDesired = new AddDesiredListing(
        steamid,
        desired[0].listing,
        0,
      ).setID(existingDesired.getID());

      expect(result).toEqual([expectedDesired]);

      expect(mockEventEmitter.emit).toHaveBeenCalledTimes(1);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'desired-listings.added',
        {
          steamid,
          desired: [expectedDesired],
        },
      );
    });
  });

  describe('Removing desired', () => {
    it('should not delete anything if no match', async () => {
      const remove: RemoveListingDto[] = [
        {
          id: '1234',
        },
      ];

      const steamid = new SteamID('76561198120070906');

      jest
        .spyOn(DesiredListingsService.prototype, 'getDesiredByHashes')
        .mockResolvedValue(new Map());

      await service.removeDesired(steamid, remove);

      expectMockUsing(steamid, [hashListing(remove[0])]);

      expect(mockRedis.exec).toHaveBeenCalledTimes(0);

      expect(mockEventEmitter.emitAsync).toHaveBeenCalledTimes(0);
    });

    it('should delete desired listing using listing', async () => {
      const remove: RemoveListingDto = {
        id: '1234',
      };

      const steamid = new SteamID('76561198120070906');

      const existingDesired: DesiredListing = new DesiredListing(
        steamid,
        {
          id: remove.id,
          currencies: {
            keys: 1,
          },
        },
        0,
      );

      jest
        .spyOn(DesiredListingsService.prototype, 'getDesiredByHashes')
        .mockResolvedValue(
          new Map([[existingDesired.getHash(), existingDesired]]),
        );

      await service.removeDesired(steamid, [remove]);

      expectMockUsing(steamid, [hashListing(remove)]);

      expect(mockRedis.hdel).toHaveBeenCalledTimes(1);
      expect(mockRedis.hdel).toHaveBeenCalledWith(
        'listings:desired:' + steamid.getSteamID64(),
        existingDesired.getHash(),
      );
      expect(mockRedis.exec).toHaveBeenCalledTimes(1);

      expect(mockEventEmitter.emit).toHaveBeenCalledTimes(1);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'desired-listings.removed',
        {
          steamid,
          desired: [existingDesired],
        },
      );
    });

    it('should delete desired listing using hash', async () => {
      const listing: AddListingDto = {
        id: '1234',
        currencies: {
          keys: 1,
        },
      };

      const hash = hashListing(listing);

      const steamid = new SteamID('76561198120070906');

      const existingDesired: DesiredListing = new DesiredListing(
        steamid,
        listing,
        0,
      );

      jest
        .spyOn(DesiredListingsService.prototype, 'getDesiredByHashes')
        .mockResolvedValue(
          new Map([[existingDesired.getHash(), existingDesired]]),
        );

      await service.removeDesired(steamid, [{ hash }]);

      expectMockUsing(steamid, [hash]);

      expect(mockRedis.hdel).toHaveBeenCalledTimes(1);
      expect(mockRedis.hdel).toHaveBeenCalledWith(
        'listings:desired:' + steamid.getSteamID64(),
        existingDesired.getHash(),
      );
      expect(mockRedis.exec).toHaveBeenCalledTimes(1);

      expect(mockEventEmitter.emit).toHaveBeenCalledTimes(1);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'desired-listings.removed',
        {
          steamid,
          desired: [existingDesired],
        },
      );
    });
  });

  describe('Static methods', () => {
    it('should save desired listings', () => {
      const steamid = new SteamID('76561198120070906');

      const chainable = mockRedis as unknown as ChainableCommander;

      const listing: AddListingDto = {
        id: '1234',
        currencies: {
          keys: 1,
        },
      };

      const desired = new DesiredListing(steamid, listing, 0);

      DesiredListingsService.chainableSaveDesired(chainable, steamid, [
        desired,
      ]);

      const saved: DesiredListingInterface = {
        hash: desired.getHash(),
        id: desired.getID(),
        steamid64: desired.getSteamID().getSteamID64(),
        listing: desired.getListing(),
        updatedAt: desired.getUpdatedAt(),
      };

      expect(mockRedis.hset).toHaveBeenCalledTimes(1);
      expect(mockRedis.hset).toHaveBeenCalledWith(
        'listings:desired:' + steamid.getSteamID64(),
        desired.getHash(),
        pack(saved),
      );
    });
  });
});

/**
 * Test if desired listings were locked
 * @param {SteamID} steamid
 **/
function expectMockUsing(steamid: SteamID, hashes: string[]) {
  expect(mock.redlock.using).toHaveBeenCalledTimes(1);

  const resources = hashes.map(
    (hash) => `locking:desired:${steamid.getSteamID64()}:${hash}`,
  );

  expect(mock.redlock.using).toHaveBeenCalledWith(
    resources,
    5000,
    expect.any(Function),
  );
}

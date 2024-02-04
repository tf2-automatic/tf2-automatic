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
import Redis from 'ioredis';
import { DesiredListing } from './classes/desired-listing.class';
import { DesiredListing as DesiredListingInternal } from './interfaces/desired-listing.interface';
import hashListing from './utils/desired-listing-hash';
import { RedlockAbortSignal } from 'redlock';

jest.mock('eventemitter2');

const mockUsing = jest
  .fn()
  .mockImplementation(
    (
      _: unknown,
      __: unknown,
      callback: (signal: Partial<RedlockAbortSignal>) => Promise<unknown>,
    ) => {
      return Promise.resolve().then(() => {
        return callback({ aborted: false });
      });
    },
  );

jest.mock('redlock', () => {
  return jest.fn().mockImplementation(() => {
    return {
      using: mockUsing,
    };
  });
});

describe('DesiredListingsService', () => {
  let service: DesiredListingsService;
  let mockEventEmitter: EventEmitter2;
  let mockRedis: Partial<Redis>;

  jest.spyOn(Date, 'now').mockReturnValue(0);

  beforeEach(async () => {
    jest.clearAllMocks();

    mockRedis = {
      multi: jest.fn().mockReturnThis(),
      hset: jest.fn(),
      hdel: jest.fn(),
      exec: jest.fn(),
    };

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
        .spyOn(DesiredListingsService.prototype, 'getDesiredByHashesNew')
        .mockResolvedValue(new Map());

      const result = await service.addDesired(steamid, desired);

      expect(mockUsing).toHaveBeenCalledTimes(1);
      expect(mockUsing).toHaveBeenCalledWith(
        ['desired:' + steamid.getSteamID64()],
        1000,
        expect.any(Function),
      );

      const hash = hashListing(desired[0].listing);

      const saved: DesiredListingInternal = {
        hash,
        steamid64: steamid.getSteamID64(),
        listing: desired[0].listing,
        updatedAt: 0,
      };

      expect(saved.steamid64).toEqual(steamid.getSteamID64());

      expect(mockRedis.hset).toHaveBeenCalledTimes(1);
      expect(mockRedis.hset).toHaveBeenCalledWith(
        'bptf-manager:data:listings:desired:' + steamid.getSteamID64(),
        hash,
        JSON.stringify(saved),
      );
      expect(mockRedis.exec).toHaveBeenCalledTimes(1);

      expect(result).toEqual([
        {
          id: saved.id ?? null,
          hash: saved.hash,
          listing: saved.listing,
          updatedAt: saved.updatedAt,
          error: saved.error,
          priority: saved.priority,
          lastAttemptedAt: saved.lastAttemptedAt,
        },
      ]);

      expect(mockEventEmitter.emitAsync).toHaveBeenCalledTimes(1);
      expect(mockEventEmitter.emitAsync).toHaveBeenCalledWith(
        'desired-listings.added',
        {
          steamid,
          desired: [saved],
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

      const existingDesired = new DesiredListing(
        hashListing(listing),
        steamid,
        listing,
        0,
      );

      existingDesired.setID('1234');

      jest
        .spyOn(DesiredListingsService.prototype, 'getDesiredByHashesNew')
        .mockResolvedValue(
          new Map([[existingDesired.getHash(), existingDesired]]),
        );

      const result = await service.addDesired(steamid, desired);

      expectMockUsing(steamid);

      // Reusing it because it is the exact same because no changes were made
      const saved: DesiredListingInternal = existingDesired.toJSON();

      expect(saved.steamid64).toEqual(steamid.getSteamID64());

      expect(mockRedis.hset).toHaveBeenCalledTimes(1);
      expect(mockRedis.hset).toHaveBeenCalledWith(
        'bptf-manager:data:listings:desired:' + saved.steamid64,
        saved.hash,
        JSON.stringify(saved),
      );
      expect(mockRedis.exec).toHaveBeenCalledTimes(1);

      expect(result).toEqual([
        {
          id: saved.id,
          hash: saved.hash,
          listing: saved.listing,
          updatedAt: saved.updatedAt,
          error: saved.error,
          priority: saved.priority,
          lastAttemptedAt: saved.lastAttemptedAt,
        },
      ]);

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

      const existingDesired = new DesiredListing(
        hashListing(existingListing),
        steamid,
        existingListing,
        0,
      );

      existingDesired.setID('1234');

      jest
        .spyOn(DesiredListingsService.prototype, 'getDesiredByHashesNew')
        .mockResolvedValue(
          new Map([[existingDesired.getHash(), existingDesired]]),
        );

      const result = await service.addDesired(steamid, desired);

      expectMockUsing(steamid);

      const saved: DesiredListingInternal = {
        hash: hashListing(desired[0].listing),
        id: existingDesired.getID(),
        steamid64: existingDesired.getSteamID().getSteamID64(),
        listing: desired[0].listing,
        updatedAt: 0,
      };

      expect(saved.steamid64).toEqual(steamid.getSteamID64());

      expect(mockRedis.hset).toHaveBeenCalledTimes(1);
      expect(mockRedis.hset).toHaveBeenCalledWith(
        'bptf-manager:data:listings:desired:' + saved.steamid64,
        saved.hash,
        JSON.stringify(saved),
      );
      expect(mockRedis.exec).toHaveBeenCalledTimes(1);

      expect(result).toEqual([
        {
          id: saved.id,
          hash: saved.hash,
          listing: saved.listing,
          updatedAt: saved.updatedAt,
          error: saved.error,
          priority: saved.priority,
          lastAttemptedAt: saved.lastAttemptedAt,
        },
      ]);

      expect(mockEventEmitter.emitAsync).toHaveBeenCalledTimes(1);
      expect(mockEventEmitter.emitAsync).toHaveBeenCalledWith(
        'desired-listings.added',
        {
          steamid,
          desired: [saved],
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
        .spyOn(DesiredListingsService.prototype, 'getDesiredByHashesNew')
        .mockResolvedValue(new Map());

      await service.removeDesired(steamid, remove);

      expectMockUsing(steamid);

      expect(mockRedis.exec).toHaveBeenCalledTimes(0);

      expect(mockEventEmitter.emitAsync).toHaveBeenCalledTimes(0);
    });

    it('should delete desired listing using listing', async () => {
      const remove: RemoveListingDto = {
        id: '1234',
      };

      const steamid = new SteamID('76561198120070906');

      const existingDesired: DesiredListing = new DesiredListing(
        hashListing(remove),
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
        .spyOn(DesiredListingsService.prototype, 'getDesiredByHashesNew')
        .mockResolvedValue(
          new Map([[existingDesired.getHash(), existingDesired]]),
        );

      await service.removeDesired(steamid, [remove]);

      expectMockUsing(steamid);

      expect(mockRedis.hdel).toHaveBeenCalledTimes(1);
      expect(mockRedis.hdel).toHaveBeenCalledWith(
        'bptf-manager:data:listings:desired:' + steamid.getSteamID64(),
        existingDesired.getHash(),
      );
      expect(mockRedis.exec).toHaveBeenCalledTimes(1);

      expect(mockEventEmitter.emitAsync).toHaveBeenCalledTimes(1);
      expect(mockEventEmitter.emitAsync).toHaveBeenCalledWith(
        'desired-listings.removed',
        {
          steamid,
          desired: [existingDesired.toJSON()],
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

      const remove: RemoveListingDto = {
        hash: hashListing(listing),
      };

      const steamid = new SteamID('76561198120070906');

      const existingDesired: DesiredListing = new DesiredListing(
        hashListing(remove),
        steamid,
        listing,
        0,
      );

      jest
        .spyOn(DesiredListingsService.prototype, 'getDesiredByHashesNew')
        .mockResolvedValue(
          new Map([[existingDesired.getHash(), existingDesired]]),
        );

      await service.removeDesired(steamid, [remove]);

      expectMockUsing(steamid);

      expect(mockRedis.hdel).toHaveBeenCalledTimes(1);
      expect(mockRedis.hdel).toHaveBeenCalledWith(
        'bptf-manager:data:listings:desired:' + steamid.getSteamID64(),
        existingDesired.getHash(),
      );
      expect(mockRedis.exec).toHaveBeenCalledTimes(1);

      expect(mockEventEmitter.emitAsync).toHaveBeenCalledTimes(1);
      expect(mockEventEmitter.emitAsync).toHaveBeenCalledWith(
        'desired-listings.removed',
        {
          steamid,
          desired: [existingDesired.toJSON()],
        },
      );
    });
  });
});

/**
 * Test if desired listings were locked
 * @param {SteamID} steamid
 **/
function expectMockUsing(steamid: SteamID) {
  expect(mockUsing).toHaveBeenCalledTimes(1);
  expect(mockUsing).toHaveBeenCalledWith(
    ['desired:' + steamid.getSteamID64()],
    1000,
    expect.any(Function),
  );
}

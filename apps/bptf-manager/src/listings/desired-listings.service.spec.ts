import { Test, TestingModule } from '@nestjs/testing';
import { DesiredListingsService } from './desired-listings.service';
import { DesiredListingDto } from '@tf2-automatic/bptf-manager-data';
import SteamID from 'steamid';
import { getRedisToken } from '@songkeys/nestjs-redis';
import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter';
import Redis from 'ioredis';
import { RedlockAbortSignal } from 'redlock';
import { DesiredListing } from './classes/desired-listing.class';

jest.mock('redlock', () => {
  return jest.fn().mockImplementation(() => {
    return {
      using: (
        _: unknown,
        __: unknown,
        callback: (signal: Partial<RedlockAbortSignal>) => Promise<unknown>,
      ) => callback({ aborted: false }),
    };
  });
});

jest.mock('eventemitter2');

describe('DesiredListingsService', () => {
  let service: DesiredListingsService;
  let eventEmitter: EventEmitter2;
  let redis: Partial<Redis>;

  jest.spyOn(Date, 'now').mockReturnValue(0);

  beforeEach(async () => {
    jest.clearAllMocks();

    redis = {
      multi: jest.fn().mockReturnThis(),
      hset: jest.fn(),
      exec: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DesiredListingsService,
        {
          provide: getRedisToken('default'),
          useValue: redis,
        },
      ],
      imports: [EventEmitterModule.forRoot()],
    }).compile();

    service = module.get<DesiredListingsService>(DesiredListingsService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
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

      expect(redis.hset).toHaveBeenCalledTimes(1);
      expect(redis.hset).toHaveBeenCalledWith(
        'bptf-manager:data:listings:desired:76561198120070906',
        'ccb2036e25f8590fec7cdfbb5269406f8267f322',
        JSON.stringify({
          hash: 'ccb2036e25f8590fec7cdfbb5269406f8267f322',
          steamid64: '76561198120070906',
          listing: { id: '1234', currencies: { keys: 1 } },
          updatedAt: 0,
        }),
      );
      expect(redis.exec).toHaveBeenCalledTimes(1);

      expect(result).toEqual([
        {
          id: null,
          hash: 'ccb2036e25f8590fec7cdfbb5269406f8267f322',
          listing: { id: '1234', currencies: { keys: 1 } },
          updatedAt: 0,
          error: undefined,
          priority: undefined,
          lastAttemptedAt: undefined,
        },
      ]);

      expect(eventEmitter.emitAsync).toHaveBeenCalledTimes(1);
      expect(eventEmitter.emitAsync).toHaveBeenCalledWith(
        'desired-listings.added',
        {
          steamid,
          desired: [
            {
              hash: 'ccb2036e25f8590fec7cdfbb5269406f8267f322',
              steamid64: '76561198120070906',
              listing: { id: '1234', currencies: { keys: 1 } },
              updatedAt: 0,
            },
          ],
        },
      );
    });

    it('should "do nothing" when matching existing desired listing', async () => {
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

      const existingDesired = new DesiredListing(
        'ccb2036e25f8590fec7cdfbb5269406f8267f322',
        new SteamID('76561198120070906'),
        {
          id: '1234',
          currencies: {
            keys: 1,
          },
        },
        0,
      );

      existingDesired.setID('1234');

      jest
        .spyOn(DesiredListingsService.prototype, 'getDesiredByHashesNew')
        .mockResolvedValue(
          new Map([[existingDesired.getHash(), existingDesired]]),
        );

      const result = await service.addDesired(steamid, desired);

      expect(redis.hset).toHaveBeenCalledTimes(1);
      expect(redis.hset).toHaveBeenCalledWith(
        'bptf-manager:data:listings:desired:76561198120070906',
        'ccb2036e25f8590fec7cdfbb5269406f8267f322',
        JSON.stringify({
          hash: 'ccb2036e25f8590fec7cdfbb5269406f8267f322',
          id: '1234',
          steamid64: '76561198120070906',
          listing: { id: '1234', currencies: { keys: 1 } },
          updatedAt: 0,
        }),
      );
      expect(redis.exec).toHaveBeenCalledTimes(1);

      expect(result).toEqual([
        {
          id: '1234',
          hash: 'ccb2036e25f8590fec7cdfbb5269406f8267f322',
          listing: { id: '1234', currencies: { keys: 1 } },
          updatedAt: 0,
          error: undefined,
          priority: undefined,
          lastAttemptedAt: undefined,
        },
      ]);

      expect(eventEmitter.emitAsync).toHaveBeenCalledTimes(0);
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

      const existingDesired = new DesiredListing(
        'ccb2036e25f8590fec7cdfbb5269406f8267f322',
        new SteamID('76561198120070906'),
        {
          id: '1234',
          currencies: {
            keys: 1,
          },
        },
        0,
      );

      existingDesired.setID('1234');

      jest
        .spyOn(DesiredListingsService.prototype, 'getDesiredByHashesNew')
        .mockResolvedValue(
          new Map([[existingDesired.getHash(), existingDesired]]),
        );

      const result = await service.addDesired(steamid, desired);

      expect(redis.hset).toHaveBeenCalledTimes(1);
      expect(redis.hset).toHaveBeenCalledWith(
        'bptf-manager:data:listings:desired:76561198120070906',
        'ccb2036e25f8590fec7cdfbb5269406f8267f322',
        JSON.stringify({
          hash: 'ccb2036e25f8590fec7cdfbb5269406f8267f322',
          id: '1234',
          steamid64: '76561198120070906',
          listing: { id: '1234', currencies: { keys: 2 } },
          updatedAt: 0,
        }),
      );
      expect(redis.exec).toHaveBeenCalledTimes(1);

      expect(result).toEqual([
        {
          id: '1234',
          hash: 'ccb2036e25f8590fec7cdfbb5269406f8267f322',
          listing: { id: '1234', currencies: { keys: 2 } },
          updatedAt: 0,
          error: undefined,
          priority: undefined,
          lastAttemptedAt: undefined,
        },
      ]);

      expect(eventEmitter.emitAsync).toHaveBeenCalledTimes(1);
      expect(eventEmitter.emitAsync).toHaveBeenCalledWith(
        'desired-listings.added',
        {
          steamid,
          desired: [
            {
              hash: 'ccb2036e25f8590fec7cdfbb5269406f8267f322',
              id: '1234',
              steamid64: '76561198120070906',
              listing: { id: '1234', currencies: { keys: 2 } },
              updatedAt: 0,
            },
          ],
        },
      );
    });
  });
});

import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter';
import { mock } from '@tf2-automatic/testing';
import { DesiredListingsListener } from './desired-listings.listener';
import { getRedisToken } from '@songkeys/nestjs-redis';
import { Test, TestingModule } from '@nestjs/testing';
import { DesiredListingsService } from '../desired-listings.service';
import { Listing, ListingError } from '@tf2-automatic/bptf-manager-data';
import SteamID from 'steamid';
import { DesiredListing as DesiredListingClass } from '../classes/desired-listing.class';
import { DesiredListing as DesiredListingInterface } from '@tf2-automatic/bptf-manager-data';

jest.mock('eventemitter2');
jest.mock('redlock', () => jest.fn().mockImplementation(() => mock.redlock));

describe('DesiredListingsListener', () => {
  let service: DesiredListingsListener;
  let mockEventEmitter: EventEmitter2;

  jest.spyOn(Date, 'now').mockReturnValue(0);

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DesiredListingsService,
        DesiredListingsListener,
        {
          provide: getRedisToken('default'),
          useValue: mock.redis,
        },
      ],
      imports: [EventEmitterModule.forRoot()],
    }).compile();

    service = module.get<DesiredListingsListener>(DesiredListingsListener);
    mockEventEmitter = module.get<EventEmitter2>(EventEmitter2);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should add errors to listings when they failed to be created', async () => {
    const steamid = new SteamID('76561198120070906');

    const desired = new DesiredListingClass(
      steamid,
      {
        id: '1234',
        currencies: {
          keys: 1,
        },
      },
      0,
    );

    jest
      .spyOn(DesiredListingsService.prototype, 'getDesiredByHashes')
      .mockResolvedValue(new Map([[desired.getHash(), desired]]));

    await service.currentListingsFailed({
      steamid,
      errors: {
        [desired.getHash()]: ListingError.ItemDoesNotExist,
      },
    });

    const saved: DesiredListingInterface = {
      hash: desired.getHash(),
      id: null,
      steamid64: steamid.getSteamID64(),
      listing: desired.getListing(),
      error: ListingError.ItemDoesNotExist,
      lastAttemptedAt: 0,
      updatedAt: 0,
    };

    expect(mock.redis.hset).toHaveBeenCalledTimes(1);
    expect(mock.redis.hset).toHaveBeenCalledWith(
      'bptf-manager:data:listings:desired:' + steamid.getSteamID64(),
      desired.getHash(),
      JSON.stringify(saved),
    );
    expect(mock.redis.exec).toHaveBeenCalledTimes(1);
  });

  it('should remove ids from all desired listings when all current listings are deleted', async () => {
    const steamid = new SteamID('76561198120070906');

    const desired = new DesiredListingClass(
      steamid,
      {
        id: '1234',
        currencies: {
          keys: 1,
        },
      },
      0,
    ).setID('1234');

    jest
      .spyOn(DesiredListingsService.prototype, 'getAllDesired')
      .mockResolvedValue([desired]);

    await service.currentListingsDeletedAll(steamid);

    // Can't compare it to desired.toJSON() because it is the same object
    // and it is modified by the listener
    const saved: DesiredListingInterface = {
      hash: desired.getHash(),
      id: null,
      steamid64: steamid.getSteamID64(),
      listing: desired.getListing(),
      updatedAt: 0,
      error: undefined,
    };

    expect(mock.redis.hset).toHaveBeenCalledTimes(1);
    expect(mock.redis.hset).toHaveBeenCalledWith(
      'bptf-manager:data:listings:desired:' + steamid.getSteamID64(),
      desired.getHash(),
      JSON.stringify(saved),
    );
    expect(mock.redis.exec).toHaveBeenCalledTimes(1);
  });

  it('should update ids when listings are created', async () => {
    const steamid = new SteamID('76561198120070906');

    // The desired listing that we will create a listing for
    const desired = new DesiredListingClass(
      steamid,
      {
        id: '1234',
        currencies: {
          keys: 1,
        },
      },
      0,
    );

    // Mock that the desired listing exists in the database
    jest
      .spyOn(DesiredListingsService.prototype, 'getDesiredByHashes')
      .mockResolvedValue(new Map([[desired.getHash(), desired]]));

    // Current listings
    const listings: Record<string, Listing> = {
      [desired.getHash()]: {
        id: 'abc123',
        currencies: {
          keys: 1,
        },
        item: {},
        archived: false,
        listedAt: 0,
        bumpedAt: 0,
      },
    };

    // Trigger the function with the hash of the desired listing and the current listing
    await service.currentListingsCreated({
      steamid,
      listings,
    });

    // The listing that is going to be saved to the database
    const saved: DesiredListingInterface = {
      hash: desired.getHash(),
      id: 'abc123',
      steamid64: steamid.getSteamID64(),
      listing: desired.getListing(),
      lastAttemptedAt: 0,
      updatedAt: 0,
      error: undefined,
    };

    // Check if the desired listing is saved to the database
    expect(mock.redis.hset).toHaveBeenCalledTimes(1);
    expect(mock.redis.hset).toHaveBeenCalledWith(
      'bptf-manager:data:listings:desired:' + steamid.getSteamID64(),
      desired.getHash(),
      JSON.stringify(saved),
    );
    expect(mock.redis.exec).toHaveBeenCalledTimes(1);

    // Check if the event is emitted
    expect(mockEventEmitter.emitAsync).toHaveBeenCalledTimes(1);
    expect(mockEventEmitter.emitAsync).toHaveBeenCalledWith(
      'desired-listings.created',
      {
        steamid: steamid,
        desired: [
          new DesiredListingClass(steamid, desired.getListing(), 0)
            .setID('abc123')
            .setLastAttemptedAt(0),
        ],
        listings,
      },
    );
  });
});

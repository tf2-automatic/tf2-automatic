import { Test, TestingModule } from '@nestjs/testing';
import { DesiredListingsService } from './desired-listings.service';
import {
  ExtendedDesiredListing,
  ListingError,
} from './interfaces/desired-listing.interface';

function createDesired(): ExtendedDesiredListing {
  return {
    hash: '',
    steamid64: '',
    listing: {
      currencies: {
        keys: 0,
        metal: 0,
      },
    },
    updatedAt: 0,
  };
}

describe('DesiredListingsService', () => {
  let service: DesiredListingsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: DesiredListingsService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<DesiredListingsService>(DesiredListingsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('#isDesiredDifferent', () => {
    it('should return false when listing did not change', () => {
      const desired = createDesired();
      const current = createDesired();

      const result = DesiredListingsService.isDesiredDifferent(
        desired,
        current,
      );

      expect(result).toBe(false);
    });

    it('should return return false when listing did change', () => {
      const desired = createDesired();
      desired.listing.currencies.metal = 1;
      const current = createDesired();
      current.listing.currencies.metal = 0;

      const result = DesiredListingsService.isDesiredDifferent(
        desired,
        current,
      );

      expect(result).toBe(true);
    });

    it('should return true when force is true', () => {
      const desired = createDesired();
      desired.force = true;
      const current = createDesired();

      const result = DesiredListingsService.isDesiredDifferent(
        desired,
        current,
      );

      expect(result).toBe(true);
    });

    it('should return true when current is null', () => {
      const desired = createDesired();
      const current = null;

      const result = DesiredListingsService.isDesiredDifferent(
        desired,
        current,
      );

      expect(result).toBe(true);
    });
  });

  describe('#updateDesiredBasedOnCurrent', () => {
    it('should match id, error and lastAttemptedAt', () => {
      const desired = createDesired();
      const current = createDesired();

      current.id = '1234';
      current.error = ListingError.Unknown;
      current.lastAttemptedAt = 1234;

      DesiredListingsService.updateDesiredBasedOnCurrent(desired, current);

      expect(desired.id).toBe(current.id);
      expect(desired.error).toBe(current.error);
      expect(desired.lastAttemptedAt).toBe(current.lastAttemptedAt);
    });

    it('should set force to true if item quantity is different', () => {
      const desired = createDesired();
      const current = createDesired();

      current.listing.item = {
        quantity: 1,
      };

      desired.listing.item = {
        quantity: 2,
      };

      DesiredListingsService.updateDesiredBasedOnCurrent(desired, current);

      expect(desired.force).toBe(true);
    });
  });

  describe('#compareAndUpdateDesired', () => {
    it('should return empty array when no changes', () => {
      const desired = [createDesired()];
      const current = createDesired();

      const currentMap = {
        [current.hash]: current,
      };

      const result = DesiredListingsService.compareAndUpdateDesired(
        desired,
        currentMap,
      );

      expect(result).toEqual([]);
    });

    it('should return changed desired listings', () => {
      const desired = [createDesired()];
      const current = createDesired();

      current.listing.currencies.metal = 1;

      const currentMap = {
        [current.hash]: current,
      };

      const result = DesiredListingsService.compareAndUpdateDesired(
        desired,
        currentMap,
      );

      expect(result).toEqual(desired);
    });
  });
});

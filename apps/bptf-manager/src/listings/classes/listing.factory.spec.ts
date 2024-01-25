import SteamID from 'steamid';
import { ListingFactory } from './listing.factory';

describe('ListingFactory', () => {
  it('should create a DesiredListing', () => {
    const listing = ListingFactory.CreateDesiredListing({
      hash: '',
      steamid64: '76561198120070906',
      listing: {
        currencies: {
          keys: 0,
          metal: 0,
        },
      },
      updatedAt: 0,
    });

    expect(listing).toBeDefined();

    expect(listing.getHash()).toBe('');
    expect(listing.getSteamID().getSteamID64()).toBe('76561198120070906');
    expect(listing.getUpdatedAt()).toBe(0);
    expect(listing.getListing().currencies.keys).toBe(0);
    expect(listing.getListing().currencies.metal).toBe(0);
  });

  it('should create an AddDesiredListing', () => {
    const listing = ListingFactory.CreateDesiredListingFromDto(
      new SteamID('76561198120070906'),
      {
        listing: {
          currencies: {
            keys: 0,
            metal: 0,
          },
        },
      },
      0,
    );

    expect(listing).toBeDefined();

    expect(listing.getHash()).toBe('323217f643c3e3f1fe7532e72ac01bb0748c97be');
    expect(listing.getSteamID().getSteamID64()).toBe('76561198120070906');
    expect(listing.getListing().currencies.keys).toBe(0);
    expect(listing.getListing().currencies.metal).toBe(0);
  });
});

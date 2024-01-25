import { DesiredListing } from './desired-listing.class';
import SteamID from 'steamid';
import { ListingError } from '../interfaces/desired-listing.interface';

function createDesired(): DesiredListing {
  return new DesiredListing(
    '',
    new SteamID('76561198120070906'),
    {
      currencies: {
        keys: 0,
        metal: 0,
      },
    },
    0,
  );
}

describe('DesiredListing', () => {
  it('should update values using setters', () => {
    const desired = createDesired();

    desired.setID('1234');
    desired.setPriority(1);
    desired.setError(ListingError.Unknown);
    desired.setLastAttemptedAt(1);

    expect(desired.getID()).toBe('1234');
    expect(desired.getPriority()).toBe(1);
    expect(desired.getError()).toBe(ListingError.Unknown);
    expect(desired.getLastAttemptedAt()).toBe(1);
  });

  it('should return undefined for unset values', () => {
    const desired = createDesired();

    expect(desired.getID()).toBeUndefined();
    expect(desired.getPriority()).toBeUndefined();
    expect(desired.getError()).toBeUndefined();
    expect(desired.getLastAttemptedAt()).toBeUndefined();
  });

  it('should work with toJSON', () => {
    const desired = createDesired();

    expect(desired.toJSON()).toEqual({
      id: undefined,
      hash: '',
      steamid64: '76561198120070906',
      listing: {
        currencies: {
          keys: 0,
          metal: 0,
        },
      },
      priority: undefined,
      error: undefined,
      lastAttemptedAt: undefined,
      updatedAt: 0,
    });
  });
});

import { DesiredListing } from './desired-listing.class';
import SteamID from 'steamid';
import { AddDesiredListing } from './add-desired-listing.class';
import { ListingError } from '@tf2-automatic/bptf-manager-data';

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

function createAddDesired(): AddDesiredListing {
  return new AddDesiredListing(
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

describe('AddDesiredListing', () => {
  it('should update values using setters', () => {
    const desired = createAddDesired();

    desired.setForce(true);

    expect(desired.getForce()).toBe(true);
    expect(desired.isForced()).toBe(true);
  });

  it('should return true if it is different from another listing', () => {
    const desired = createAddDesired();
    const other = createDesired();

    desired.setForce(true);

    expect(desired.isDifferent(other)).toBe(true);
  });

  it('should inherit values from another listing', () => {
    const desired = createAddDesired();
    const other = createDesired();

    other.setID('1234');
    other.setError(ListingError.Unknown);
    other.setLastAttemptedAt(1);

    desired.inherit(other);

    expect(desired.getID()).toBe('1234');
    expect(desired.getError()).toBe(ListingError.Unknown);
    expect(desired.getLastAttemptedAt()).toBe(1);
  });
});

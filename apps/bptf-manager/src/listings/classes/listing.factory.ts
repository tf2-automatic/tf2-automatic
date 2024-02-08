import { DesiredListingDto } from '@tf2-automatic/bptf-manager-data';
import { DesiredListing } from './desired-listing.class';
import { AddDesiredListing } from './add-desired-listing.class';
import { DesiredListing as DesiredListingInterface } from '@tf2-automatic/bptf-manager-data';
import hash from '../utils/desired-listing-hash';
import SteamID from 'steamid';

export class ListingFactory {
  static CreateDesiredListing(
    desired: DesiredListingInterface,
  ): DesiredListing {
    const object = new DesiredListing(
      desired.hash,
      new SteamID(desired.steamid64),
      desired.listing,
      desired.updatedAt,
    );

    if (desired.id) {
      object.setID(desired.id);
    }

    if (desired.priority) {
      object.setPriority(desired.priority);
    }

    if (desired.error) {
      object.setError(desired.error);
    }

    if (desired.lastAttemptedAt) {
      object.setLastAttemptedAt(desired.lastAttemptedAt);
    }

    return object;
  }

  static CreateDesiredListingFromDto(
    steamid: SteamID,
    dto: DesiredListingDto,
    time: number,
  ): AddDesiredListing {
    const object = new AddDesiredListing(
      hash(dto.listing),
      steamid,
      dto.listing,
      time,
    );

    if (dto.priority) {
      object.setPriority(dto.priority);
    }

    if (dto.force) {
      object.setForce(dto.force);
    }

    return object;
  }
}

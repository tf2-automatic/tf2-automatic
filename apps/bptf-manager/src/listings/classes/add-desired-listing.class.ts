import { DesiredListing } from './desired-listing.class';
import { AddListingDto } from '@tf2-automatic/bptf-manager-data';
import SteamID from 'steamid';
import hash from 'object-hash';

export class AddDesiredListing extends DesiredListing {
  private force: boolean | undefined;

  constructor(steamid: SteamID, listing: AddListingDto, updatedAt: number) {
    super(steamid, listing, updatedAt);
  }

  getForce(): boolean | undefined {
    return this.force;
  }

  isForced(): boolean {
    return this.force === true;
  }

  setForce(force: boolean): void {
    this.force = force;
  }

  isDifferent(other: DesiredListing): boolean {
    if (this.isForced()) {
      return true;
    }

    return (
      hash(this.getListing(), { respectType: false }) !==
      hash(other.getListing(), { respectType: false })
    );
  }

  inherit(other: DesiredListing): void {
    const id = other.getID();
    if (id) {
      this.setID(id);
    }

    const error = other.getError();
    if (error) {
      this.setError(error);
    }

    const lastAttemptedAt = other.getLastAttemptedAt();
    if (lastAttemptedAt) {
      this.setLastAttemptedAt(lastAttemptedAt);
    }

    if (this.isForced()) {
      return;
    }

    if (
      (this.getListing().item?.quantity ?? 1) !==
      (other.getListing().item?.quantity ?? 1)
    ) {
      // Quantity changed, the listing needs to be recreated in order to
      // reflect the new quantity
      this.setForce(true);
    }
  }
}

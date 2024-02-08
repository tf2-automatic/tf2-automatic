import { AddListingDto, ListingError } from '@tf2-automatic/bptf-manager-data';
import SteamID from 'steamid';
import { DesiredListing as DesiredListingInterface } from '@tf2-automatic/bptf-manager-data';
import hashListing from '../utils/desired-listing-hash';

export class DesiredListing {
  private hash: string;
  private steamid: SteamID;
  private id: string | null = null;
  private listing: AddListingDto;
  private priority: number | undefined;
  private error: ListingError | undefined;
  private lastAttemptedAt: number | undefined;
  private updatedAt: number;

  constructor(steamid: SteamID, listing: AddListingDto, updatedAt: number) {
    this.hash = hashListing(listing);
    this.steamid = steamid;
    this.listing = listing;
    this.updatedAt = updatedAt;
  }

  getHash(): string {
    return this.hash;
  }

  getSteamID(): SteamID {
    return this.steamid;
  }

  getID(): string | null {
    return this.id;
  }

  setID(id: string | null): DesiredListing {
    this.id = id;

    return this;
  }

  getListing(): AddListingDto {
    return this.listing;
  }

  getPriority(): number | undefined {
    return this.priority;
  }

  setPriority(priority: number): DesiredListing {
    this.priority = priority;

    return this;
  }

  getError(): ListingError | undefined {
    return this.error;
  }

  setError(error: ListingError | undefined): DesiredListing {
    this.error = error;

    return this;
  }

  getLastAttemptedAt(): number | undefined {
    return this.lastAttemptedAt;
  }

  setLastAttemptedAt(lastAttemptedAt: number): DesiredListing {
    this.lastAttemptedAt = lastAttemptedAt;

    return this;
  }

  getUpdatedAt(): number {
    return this.updatedAt;
  }

  setUpdatedAt(updatedAt: number): DesiredListing {
    this.updatedAt = updatedAt;

    return this;
  }

  toJSON(): DesiredListingInterface {
    return {
      hash: this.hash,
      id: this.id ?? null,
      steamid64: this.steamid.getSteamID64(),
      listing: this.listing,
      priority: this.priority,
      error: this.error,
      lastAttemptedAt: this.lastAttemptedAt,
      updatedAt: this.updatedAt,
    };
  }
}

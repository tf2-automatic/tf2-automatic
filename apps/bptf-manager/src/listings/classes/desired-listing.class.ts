import { AddListingDto } from '@tf2-automatic/bptf-manager-data';
import {
  DesiredListing as DesiredListingInternal,
  ListingError,
} from '../interfaces/desired-listing.interface';
import SteamID from 'steamid';

export class DesiredListing {
  private hash: string;
  private steamid: SteamID;
  private id: string | undefined;
  private listing: AddListingDto;
  private priority: number | undefined;
  private error: ListingError | undefined;
  private lastAttemptedAt: number | undefined;
  private updatedAt: number;

  constructor(
    hash: string,
    steamid: SteamID,
    listing: AddListingDto,
    updatedAt: number,
  ) {
    this.hash = hash;
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

  getID(): string | undefined {
    return this.id;
  }

  setID(id: string): void {
    this.id = id;
  }

  getListing(): AddListingDto {
    return this.listing;
  }

  getPriority(): number | undefined {
    return this.priority;
  }

  setPriority(priority: number): void {
    this.priority = priority;
  }

  getError(): ListingError | undefined {
    return this.error;
  }

  setError(error: ListingError): void {
    this.error = error;
  }

  getLastAttemptedAt(): number | undefined {
    return this.lastAttemptedAt;
  }

  setLastAttemptedAt(lastAttemptedAt: number): void {
    this.lastAttemptedAt = lastAttemptedAt;
  }

  getUpdatedAt(): number {
    return this.updatedAt;
  }

  setUpdatedAt(updatedAt: number): void {
    this.updatedAt = updatedAt;
  }

  toJSON(): DesiredListingInternal {
    return {
      hash: this.hash,
      id: this.id,
      steamid64: this.steamid.getSteamID64(),
      listing: this.listing,
      priority: this.priority,
      error: this.error,
      lastAttemptedAt: this.lastAttemptedAt,
      updatedAt: this.updatedAt,
    };
  }
}

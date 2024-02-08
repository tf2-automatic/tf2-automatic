import { AddListingDto, ListingError } from '@tf2-automatic/bptf-manager-data';
import SteamID from 'steamid';
import { DesiredListing as DesiredListingInterface } from '@tf2-automatic/bptf-manager-data';

export class DesiredListing {
  private hash: string;
  private steamid: SteamID;
  private id: string | null = null;
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

  getID(): string | null {
    return this.id;
  }

  setID(id: string | null): void {
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

  setError(error: ListingError | undefined): void {
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

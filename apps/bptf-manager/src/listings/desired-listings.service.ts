import { InjectRedis } from '@songkeys/nestjs-redis';
import {
  DesiredListing,
  DesiredListingDto,
  ListingDto,
  RemoveListingDto,
} from '@tf2-automatic/bptf-manager-data';
import { ChainableCommander, Redis } from 'ioredis';
import Redlock from 'redlock';
import SteamID from 'steamid';
import hash from 'object-hash';
import {
  DesiredListing as DesiredListingInternal,
  ExtendedDesiredListing as ExtendedDesiredListingInternal,
} from './interfaces/desired-listing.interface';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import {
  CurrentListingsCreateFailedEvent,
  CurrentListingsCreatedEvent,
  DesiredListingsAddedEvent,
  DesiredListingsCreatedEvent,
  DesiredListingsRemovedEvent,
} from './interfaces/events.interface';

const KEY_PREFIX = 'bptf-manager:data:';

export class DesiredListingsService {
  private readonly redlock: Redlock;

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.redlock = new Redlock([redis]);
  }

  async addDesired(
    steamid: SteamID,
    add: DesiredListingDto[],
  ): Promise<DesiredListing[]> {
    const now = Math.floor(Date.now() / 1000);

    const desired: ExtendedDesiredListingInternal[] = add.map((create) => {
      const obj: ExtendedDesiredListingInternal = {
        hash: DesiredListingsService.createHash(create.listing),
        steamid64: steamid.getSteamID64(),
        listing: create.listing,
        updatedAt: now,
      };

      if (create.priority !== undefined) {
        obj.priority = create.priority;
      }

      if (create.force === true) {
        obj.force = true;
      }

      return obj;
    });

    return this.redlock.using(
      ['desired:' + steamid.getSteamID64()],
      1000,
      async (signal) => {
        // Get current listings and check if they are different from the new listings
        const current = await this.getDesiredByHashes(
          steamid,
          desired.map((d) => d.hash),
        );

        if (signal.aborted) {
          throw signal.error;
        }

        const changed = DesiredListingsService.compareAndUpdateDesired(
          desired,
          current,
        );

        const transaction = this.redis.multi();
        this.chainableSaveDesired(transaction, steamid, desired);
        await transaction.exec();

        if (changed.length > 0) {
          await this.eventEmitter.emitAsync('desired-listings.added', {
            steamid,
            desired: changed,
          } satisfies DesiredListingsAddedEvent);
        }

        return this.mapDesired(desired);
      },
    );
  }

  static compareAndUpdateDesired(
    desired: ExtendedDesiredListingInternal[],
    current: Record<string, DesiredListingInternal>,
  ) {
    const changed: ExtendedDesiredListingInternal[] = [];

    desired.forEach((d) => {
      // Update desired based on current listings
      const c = current[d.hash] ?? null;

      this.updateDesiredBasedOnCurrent(d, c);

      if (c && this.isDesiredDifferent(d, c)) {
        changed.push(d);
      }
    });

    return changed;
  }

  static isDesiredDifferent(
    desired: ExtendedDesiredListingInternal,
    current: DesiredListingInternal | null,
  ): boolean {
    if (current === null) {
      return true;
    }

    if (desired.force) {
      return true;
    }

    return (
      hash(desired.listing, { respectType: false }) !==
      hash(current.listing, { respectType: false })
    );
  }

  static updateDesiredBasedOnCurrent(
    desired: ExtendedDesiredListingInternal,
    current: DesiredListingInternal,
  ): void {
    desired.id = current.id;
    desired.error = current.error;
    desired.lastAttemptedAt = current.lastAttemptedAt;

    if (desired.force) {
      return;
    }

    if (
      (desired.listing.item?.quantity ?? 1) !==
      (current.listing.item?.quantity ?? 1)
    ) {
      // Quantity changed, the listing needs to be recreated in order to
      // reflect the new quantity
      desired.force = true;
    }
  }

  async removeDesired(
    steamid: SteamID,
    remove: RemoveListingDto[],
  ): Promise<void> {
    const hashes = remove.map(
      (listing) => listing.hash ?? DesiredListingsService.createHash(listing),
    );

    return this.redlock.using(
      ['desired:' + steamid.getSteamID64()],
      1000,
      async (signal) => {
        const desiredMap = await this.getDesiredByHashes(steamid, hashes);

        if (signal.aborted) {
          throw signal.error;
        }

        const desired = Object.values(desiredMap);
        if (desired.length > 0) {
          // It is okay to only remove the matched listings because unmatched listings don't exist anyway
          const hashes = desired.map((d) => d.hash);

          const transaction = this.redis.multi();
          transaction.hdel(this.getDesiredKey(steamid), ...hashes);
          await transaction.exec();

          await this.eventEmitter.emitAsync('desired-listings.removed', {
            steamid,
            desired: desired,
          } satisfies DesiredListingsRemovedEvent);
        }
      },
    );
  }

  async getAllDesiredInternal(
    steamid: SteamID,
  ): Promise<DesiredListingInternal[]> {
    return this.redis
      .hvals(this.getDesiredKey(steamid))
      .then((values) =>
        values.map((raw) => JSON.parse(raw) as DesiredListingInternal),
      );
  }

  async getAllDesired(steamid: SteamID): Promise<DesiredListing[]> {
    return this.getAllDesiredInternal(steamid).then(this.mapDesired);
  }

  async getDesiredByHashes(
    steamid: SteamID,
    hashes: string[],
  ): Promise<Record<string, DesiredListingInternal>> {
    if (hashes.length === 0) {
      return {};
    }

    const values = await this.redis.hmget(
      this.getDesiredKey(steamid),
      ...hashes,
    );

    const result: Record<string, DesiredListingInternal> = {};

    values.forEach((raw) => {
      if (raw === null) {
        return;
      }

      const desired = JSON.parse(raw) as DesiredListingInternal;

      result[desired.hash] = desired;
    });

    return result;
  }

  @OnEvent('current-listings.created', {
    suppressErrors: false,
  })
  private async currentListingsCreated(
    event: CurrentListingsCreatedEvent,
  ): Promise<void> {
    const createdHashes = Object.keys(event.listings);

    if (createdHashes.length === 0) {
      return;
    }

    const now = Math.floor(Date.now() / 1000);

    const transaction = this.redis.multi();

    let publishDesired: DesiredListingInternal[] = [];

    // Update desired listings that were changed
    const hashes = Object.keys(event.listings);

    const desiredMap = await this.getDesiredByHashes(event.steamid, hashes);

    const desired = Object.values(desiredMap);
    desired.forEach((desired) => {
      desired.id = event.listings[desired.hash].id;
      desired.lastAttemptedAt = now;
      desired.updatedAt = now;
      delete desired.error;
    });

    if (desired.length > 0) {
      // Save listings with their new listings id
      this.chainableSaveDesired(transaction, event.steamid, desired);
      publishDesired = desired;
    }

    await transaction.exec();

    if (publishDesired.length > 0) {
      await this.eventEmitter.emitAsync('desired-listings.created', {
        steamid: event.steamid,
        desired: publishDesired,
        listings: event.listings,
      } satisfies DesiredListingsCreatedEvent);
    }
  }

  @OnEvent('current-listings.failed', { suppressErrors: false })
  private async currentListingsFailed(
    event: CurrentListingsCreateFailedEvent,
  ): Promise<void> {
    const now = Math.floor(Date.now() / 1000);

    const failedHashes = Object.keys(event.errors);

    // Update the failed desired listings with the error message
    const desiredMap = await this.getDesiredByHashes(
      event.steamid,
      failedHashes,
    );

    const desired = Object.values(desiredMap);
    desired.forEach((desired) => {
      desired.updatedAt = now;
      desired.lastAttemptedAt = now;
      desired.error = event.errors[desired.hash];
    });

    const transaction = this.redis.multi();
    this.chainableSaveDesired(transaction, event.steamid, desired);
    await transaction.exec();
  }

  @OnEvent('current-listings.deleted-all', {
    suppressErrors: false,
  })
  private async currentListingsDeletedAll(steamid: SteamID): Promise<void> {
    const now = Math.floor(Date.now() / 1000);

    const desired = await this.getAllDesiredInternal(steamid);

    if (desired.length > 0) {
      // Remove listing id from all desired listings
      desired.forEach((d) => {
        delete d.id;
        d.updatedAt = now;
      });

      const transaction = this.redis.multi();
      this.chainableSaveDesired(transaction, steamid, desired);
      await transaction.exec();
    }
  }

  async chainableSaveDesired(
    chainable: ChainableCommander,
    steamid: SteamID,
    desired: ExtendedDesiredListingInternal[],
  ) {
    chainable.hset(
      this.getDesiredKey(steamid),
      ...desired.flatMap((d) => {
        const copy = Object.assign({}, d);
        delete copy.force;
        return [copy.hash, JSON.stringify(copy)];
      }),
    );
  }

  static createHash(listing: ListingDto): string {
    if (listing.id) {
      return hash(listing.id);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const item: any = Object.assign({}, listing.item);
    delete item.quantity;

    return hash(item);
  }

  private mapDesired(desired: DesiredListingInternal[]): DesiredListing[] {
    return desired.map((d) => ({
      hash: d.hash,
      id: d.id ?? null,
      listing: d.listing,
      priority: d.priority,
      error: d.error,
      lastAttemptedAt: d.lastAttemptedAt,
      updatedAt: d.updatedAt,
    }));
  }

  private getDesiredKey(steamid: SteamID): string {
    return `${KEY_PREFIX}listings:desired:${steamid.getSteamID64()}`;
  }
}

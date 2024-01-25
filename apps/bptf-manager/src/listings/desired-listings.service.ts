import { InjectRedis } from '@songkeys/nestjs-redis';
import {
  DesiredListing,
  DesiredListingDto,
  RemoveListingDto,
} from '@tf2-automatic/bptf-manager-data';
import { ChainableCommander, Redis } from 'ioredis';
import Redlock from 'redlock';
import SteamID from 'steamid';
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
import { DesiredListing as DesiredListingClass } from './classes/desired-listing.class';
import { AddDesiredListing } from './classes/add-desired-listing.class';
import { ListingFactory } from './classes/listing.factory';
import hashListing from './utils/desired-listing-hash';

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

    const desired = add.map((create) =>
      ListingFactory.CreateDesiredListingFromDto(steamid, create, now),
    );

    return this.redlock.using(
      ['desired:' + steamid.getSteamID64()],
      1000,
      async (signal) => {
        // Get current listings and check if they are different from the new listings
        const current = await this.getDesiredByHashesNew(
          steamid,
          desired.map((d) => d.getHash()),
        );

        if (signal.aborted) {
          throw signal.error;
        }

        const changed = DesiredListingsService.compareAndUpdateDesired(
          desired,
          current,
        );

        const transaction = this.redis.multi();
        this.chainableSaveDesired(
          transaction,
          steamid,
          desired.map((d) => d.toJSON()),
        );
        await transaction.exec();

        if (changed.length > 0) {
          await this.eventEmitter.emitAsync('desired-listings.added', {
            steamid,
            desired: changed.map((d) => d.toJSON()),
          } satisfies DesiredListingsAddedEvent);
        }

        return this.mapDesired(desired.map((d) => d.toJSON()));
      },
    );
  }

  static compareAndUpdateDesired(
    desired: AddDesiredListing[],
    current: Map<string, DesiredListingClass>,
  ) {
    const changed: DesiredListingClass[] = [];

    desired.forEach((d) => {
      // Update desired based on current listings
      const c = current.get(d.getHash()) ?? null;

      if (c) {
        d.inherit(c);
      }

      if (!c || d.isDifferent(c)) {
        changed.push(d);
      }
    });

    return changed;
  }

  async removeDesired(
    steamid: SteamID,
    remove: RemoveListingDto[],
  ): Promise<void> {
    const hashes = remove.map(
      (listing) => listing.hash ?? hashListing(listing),
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

  async getDesiredByHashesNew(
    steamid: SteamID,
    hashes: string[],
  ): Promise<Map<string, DesiredListingClass>> {
    const result: Map<string, DesiredListingClass> = new Map();

    if (hashes.length === 0) {
      return result;
    }

    const values = await this.redis.hmget(
      this.getDesiredKey(steamid),
      ...hashes,
    );

    values.forEach((raw) => {
      if (raw === null) {
        return;
      }

      const desired = ListingFactory.CreateDesiredListing(
        JSON.parse(raw) as DesiredListingInternal,
      );

      result.set(desired.getHash(), desired);
    });

    return result;
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

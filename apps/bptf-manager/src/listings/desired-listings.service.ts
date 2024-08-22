import { InjectRedis } from '@songkeys/nestjs-redis';
import {
  DesiredListingDto,
  RemoveListingDto,
} from '@tf2-automatic/bptf-manager-data';
import { ChainableCommander, Redis } from 'ioredis';
import SteamID from 'steamid';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  DesiredListingsAddedEvent,
  DesiredListingsRemovedEvent,
} from './interfaces/events.interface';
import { DesiredListing } from './classes/desired-listing.class';
import { AddDesiredListing } from './classes/add-desired-listing.class';
import { ListingFactory } from './classes/listing.factory';
import hashListing from './utils/desired-listing-hash';
import { LockDuration, Locker } from '@tf2-automatic/locking';
import { Injectable } from '@nestjs/common';

const KEY_PREFIX = 'bptf-manager:data:';

@Injectable()
export class DesiredListingsService {
  private readonly locker: Locker;

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.locker = new Locker(redis);
  }

  async addDesired(
    steamid: SteamID,
    add: DesiredListingDto[],
  ): Promise<DesiredListing[]> {
    const now = Math.floor(Date.now() / 1000);

    const desired = add.map((create) =>
      ListingFactory.CreateDesiredListingFromDto(steamid, create, now),
    );

    const resources = desired.map(
      (d) => `desired:${steamid.getSteamID64()}:${d.getHash()}`,
    );

    return this.locker.using(resources, LockDuration.MEDIUM, async (signal) => {
      // Get current listings and check if they are different from the new listings
      const current = await this.getDesiredByHashes(
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
      DesiredListingsService.chainableSaveDesired(
        transaction,
        steamid,
        desired,
      );
      await transaction.exec();

      if (changed.length > 0) {
        this.eventEmitter.emit('desired-listings.added', {
          steamid,
          desired: changed,
        } satisfies DesiredListingsAddedEvent);
      }

      return desired;
    });
  }

  static compareAndUpdateDesired(
    desired: AddDesiredListing[],
    current: Map<string, DesiredListing>,
  ) {
    const changed: AddDesiredListing[] = [];

    for (let i = 0; i < desired.length; i++) {
      const d = desired[i];

      // Update desired based on current listings
      const c = current.get(d.getHash()) ?? null;

      if (c) {
        d.inherit(c);
      }

      if (!c || d.isDifferent(c)) {
        changed.push(d);
      }
    }

    return changed;
  }

  async removeDesired(
    steamid: SteamID,
    remove: RemoveListingDto[],
  ): Promise<DesiredListing[]> {
    const hashes = remove.map(
      (listing) => listing.hash ?? hashListing(listing),
    );

    const resources = hashes.map(
      (hash) => `desired:${steamid.getSteamID64()}:${hash}`,
    );

    return this.locker.using(resources, LockDuration.MEDIUM, async (signal) => {
      const map = await this.getDesiredByHashes(steamid, hashes);
      if (map.size === 0) {
        return [];
      }

      if (signal.aborted) {
        throw signal.error;
      }

      // It is okay to only remove the matched listings because unmatched listings don't exist anyway
      const desired = Array.from(map.values());

      const transaction = this.redis.multi();
      transaction.hdel(
        DesiredListingsService.getDesiredKey(steamid),
        ...desired.map((d) => d.getHash()),
      );
      await transaction.exec();

      this.eventEmitter.emit('desired-listings.removed', {
        steamid,
        desired,
      } satisfies DesiredListingsRemovedEvent);

      return desired;
    });
  }

  async getAllDesired(steamid: SteamID): Promise<DesiredListing[]> {
    const values = await this.redis.hvals(
      DesiredListingsService.getDesiredKey(steamid),
    );

    const desired = values.map((raw) =>
      ListingFactory.CreateDesiredListing(JSON.parse(raw)),
    );

    return desired;
  }

  async getDesiredByHashes(
    steamid: SteamID,
    hashes: string[],
  ): Promise<Map<string, DesiredListing>> {
    const result: Map<string, DesiredListing> = new Map();

    if (hashes.length === 0) {
      return result;
    }

    const values = await this.redis.hmget(
      DesiredListingsService.getDesiredKey(steamid),
      ...hashes,
    );

    for (let i = 0; i < values.length; i++) {
      const raw = values[i];
      if (raw === null) {
        continue;
      }

      const desired = ListingFactory.CreateDesiredListing(JSON.parse(raw));

      result.set(desired.getHash(), desired);
    }

    return result;
  }

  static chainableSaveDesired(
    chainable: ChainableCommander,
    steamid: SteamID,
    desired: DesiredListing[],
  ) {
    chainable.hset(
      this.getDesiredKey(steamid),
      ...desired.flatMap((d) => [d.getHash(), JSON.stringify(d.toJSON())]),
    );
  }

  private static getDesiredKey(steamid: SteamID): string {
    return `${KEY_PREFIX}listings:desired:${steamid.getSteamID64()}`;
  }
}

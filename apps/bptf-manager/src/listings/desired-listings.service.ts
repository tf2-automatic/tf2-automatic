import { InjectRedis } from '@songkeys/nestjs-redis';
import {
  DesiredListing,
  DesiredListingDto,
  RemoveListingDto,
} from '@tf2-automatic/bptf-manager-data';
import { ChainableCommander, Redis } from 'ioredis';
import Redlock from 'redlock';
import SteamID from 'steamid';
import { DesiredListing as DesiredListingInterface } from '@tf2-automatic/bptf-manager-data';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  DesiredListingsAddedEvent,
  DesiredListingsRemovedEvent,
} from './interfaces/events.interface';
import { DesiredListing as DesiredListingClass } from './classes/desired-listing.class';
import { AddDesiredListing } from './classes/add-desired-listing.class';
import { ListingFactory } from './classes/listing.factory';
import hashListing from './utils/desired-listing-hash';
import { ExtendedDesiredListing } from './interfaces/desired-listing.interface';

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
        DesiredListingsService.chainableSaveDesired(
          transaction,
          steamid,
          desired,
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
        const map = await this.getDesiredByHashesNew(steamid, hashes);

        if (signal.aborted) {
          throw signal.error;
        }

        if (map.size > 0) {
          // It is okay to only remove the matched listings because unmatched listings don't exist anyway
          const desired = Array.from(map.values());
          const hashes = desired.map((d) => d.getHash());

          const transaction = this.redis.multi();
          transaction.hdel(this.getDesiredKey(steamid), ...hashes);
          await transaction.exec();

          await this.eventEmitter.emitAsync('desired-listings.removed', {
            steamid,
            desired: desired.map((d) => d.toJSON()),
          } satisfies DesiredListingsRemovedEvent);
        }
      },
    );
  }

  async getAllDesiredInternal(
    steamid: SteamID,
  ): Promise<DesiredListingInterface[]> {
    return this.redis
      .hvals(this.getDesiredKey(steamid))
      .then((values) =>
        values.map((raw) => JSON.parse(raw) as DesiredListingInterface),
      );
  }

  async getAllDesiredInternalNew(
    steamid: SteamID,
  ): Promise<DesiredListingClass[]> {
    const values = await this.redis.hvals(this.getDesiredKey(steamid));

    const desired = values.map((raw) =>
      ListingFactory.CreateDesiredListing(
        JSON.parse(raw) as DesiredListingInterface,
      ),
    );

    return desired;
  }

  async getAllDesired(steamid: SteamID): Promise<DesiredListing[]> {
    const desired = await this.getAllDesiredInternalNew(steamid);

    return this.mapDesired(desired.map((d) => d.toJSON()));
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
        JSON.parse(raw) as DesiredListingInterface,
      );

      result.set(desired.getHash(), desired);
    });

    return result;
  }

  async getDesiredByHashes(
    steamid: SteamID,
    hashes: string[],
  ): Promise<Record<string, DesiredListingInterface>> {
    if (hashes.length === 0) {
      return {};
    }

    const values = await this.redis.hmget(
      this.getDesiredKey(steamid),
      ...hashes,
    );

    const result: Record<string, DesiredListingInterface> = {};

    values.forEach((raw) => {
      if (raw === null) {
        return;
      }

      const desired = JSON.parse(raw) as DesiredListingInterface;

      result[desired.hash] = desired;
    });

    return result;
  }

  async chainableSaveDesired(
    chainable: ChainableCommander,
    steamid: SteamID,
    desired: ExtendedDesiredListing[],
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

  static chainableSaveDesired(
    chainable: ChainableCommander,
    steamid: SteamID,
    desired: DesiredListingClass[],
  ) {
    chainable.hset(
      this.getDesiredKey(steamid),
      ...desired.flatMap((d) => [d.getHash(), JSON.stringify(d.toJSON())]),
    );
  }

  private mapDesired(desired: DesiredListingInterface[]): DesiredListing[] {
    return desired.map((d) => ({
      hash: d.hash,
      id: d.id ?? null,
      steamid64: d.steamid64,
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

  private static getDesiredKey(steamid: SteamID): string {
    return `${KEY_PREFIX}listings:desired:${steamid.getSteamID64()}`;
  }
}

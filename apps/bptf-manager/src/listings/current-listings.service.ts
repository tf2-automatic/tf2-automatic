import { InjectRedis } from '@songkeys/nestjs-redis';
import {
  Listing,
  ListingDto,
  ListingError,
  Token,
} from '@tf2-automatic/bptf-manager-data';
import { Redis } from 'ioredis';
import {
  BatchCreateListingResponse,
  BatchDeleteListingResponse,
  BatchUpdateListingResponse,
  DeleteAllListingsResponse,
  DeleteListingsResponse,
  GetListingsResponse,
  UpdateListingBody,
} from './interfaces/bptf.interface';
import { firstValueFrom } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import SteamID from 'steamid';
import {
  CurrentListingsCreateFailedEvent,
  CurrentListingsCreatedEvent,
  CurrentListingsDeletedEvent,
} from './interfaces/events.interface';
import { Logger } from '@nestjs/common';
import { ListingLimitsService } from './listing-limits.service';
import { ListingLimits } from '@tf2-automatic/bptf-manager-data';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import Redlock from 'redlock';
import {
  JobData,
  JobName,
  JobType,
} from './interfaces/get-listings.queue.interface';
import { DesiredListing } from './classes/desired-listing.class';

const KEY_PREFIX = 'bptf-manager:data:';

export class CurrentListingsService {
  private readonly logger = new Logger(CurrentListingsService.name);

  private readonly redlock: Redlock;

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly httpService: HttpService,
    private readonly eventEmitter: EventEmitter2,
    private readonly listingLimitsService: ListingLimitsService,
    @InjectQueue('get-listings')
    private readonly getListingsQueue: Queue<JobData, unknown, JobName>,
  ) {
    this.redlock = new Redlock([redis]);
  }

  @OnEvent('agents.registered')
  private async agentsRegistered(steamid: SteamID): Promise<void> {
    return this.refreshListings(steamid);
  }

  async refreshListings(steamid: SteamID): Promise<void> {
    const time = Date.now();
    await Promise.all([
      this.createJob(steamid, JobType.Active, time),
      this.createJob(steamid, JobType.Archived, time),
    ]);
  }

  async createJob(
    steamid: SteamID,
    type: JobType,
    time: number = Date.now(),
    skip?: number,
    limit?: number,
    delay?: number,
  ): Promise<void> {
    await this.getListingsQueue.add(
      type,
      {
        steamid64: steamid.getSteamID64(),
        start: time,
        skip,
        limit,
      },
      {
        jobId:
          steamid.getSteamID64() +
          ':' +
          type +
          ':' +
          time +
          ':' +
          skip +
          ':' +
          limit,
        delay,
      },
    );
  }

  async getAllCurrent(steamid: SteamID): Promise<Listing[]> {
    const values = await this.redis.hvals(this.getCurrentKey(steamid));

    return values.map((raw) => {
      return JSON.parse(raw) as Listing;
    });
  }

  async getListingsByIds(
    steamid: SteamID,
    ids: string[],
  ): Promise<Map<string, Listing>> {
    const result = new Map<string, Listing>();

    if (ids.length === 0) {
      return result;
    }

    const values = await this.redis.hmget(this.getCurrentKey(steamid), ...ids);

    values.forEach((raw) => {
      if (raw === null) {
        return;
      }

      const listing = JSON.parse(raw) as Listing;

      result.set(listing.id, listing);
    });

    return result;
  }

  async deleteListings(token: Token, ids: string[]) {
    const steamid = new SteamID(token.steamid64);

    this.logger.log(
      'Deleting ' +
        ids.length +
        ' active listing(s) for ' +
        steamid.getSteamID64() +
        '...',
    );

    // Figure out what listings should be deleted from the database
    const exists = await this.redis.smismember(
      this.getCurrentShouldNotDeleteEntryKey(steamid),
      ...ids,
    );

    const limits = await this.listingLimitsService.getLimits(steamid);

    const resources = ids.map((id) =>
      this.getResourceForListingId(steamid, id),
    );
    const result = await this.redlock.using(resources, 10000, () => {
      // Delete listings on backpack.tf
      return this._deleteListings(token, ids);
    });

    this.logger.log('Deleted ' + result.deleted + ' active listing(s)');

    await this.deleteTempListings(steamid, ids);

    // Filter out listings that should not be deleted (for example, when deleting active listing because newest was archived)
    const remove =
      exists.length === 0 ? ids : ids.filter((id, index) => !exists[index]);

    // Delete current listings in database
    const transaction = this.redis.multi();

    if (remove.length > 0) {
      // Remove listings from database
      transaction.hdel(this.getCurrentKey(steamid), ...remove);
    }

    // Remove flag that listings should not be deleted
    transaction.srem(this.getCurrentShouldNotDeleteEntryKey(steamid), ...ids);

    if (result.deleted > 0) {
      // Remove old listings from old limits
      this.listingLimitsService.chainableSaveLimits(transaction, steamid, {
        used: Math.max(limits.used - result.deleted, 0),
      });
    }

    await transaction.exec();

    // Publish that the listings have been deleted
    await this.eventEmitter.emitAsync('current-listings.deleted', {
      steamid,
      ids,
      isActive: true,
    } satisfies CurrentListingsDeletedEvent);

    return result;
  }

  async deleteArchivedListings(token: Token, ids: string[]) {
    const steamid = new SteamID(token.steamid64);

    this.logger.log(
      'Deleting ' +
        ids.length +
        ' archived listing(s) for ' +
        steamid.getSteamID64() +
        '...',
    );

    const resources = ids.map((id) =>
      this.getResourceForListingId(steamid, id),
    );
    const result = await this.redlock.using(resources, 10000, () => {
      // Delete listings on backpack.tf
      return this._deleteArchivedListings(token, ids);
    });

    this.logger.log('Deleted ' + result.deleted + ' archived listing(s)');

    // Delete current listings in database
    await this.redis.hdel(this.getCurrentKey(steamid), ...ids);

    // Publish that the listings have been deleted
    await this.eventEmitter.emitAsync('current-listings.deleted', {
      steamid,
      ids,
      isActive: false,
    } satisfies CurrentListingsDeletedEvent);

    return result;
  }

  async createListings(token: Token, desired: DesiredListing[]) {
    const listings: ListingDto[] = [];
    const hashes: string[] = [];

    desired.forEach((d) => {
      listings.push(d.getListing());
      hashes.push(d.getHash());
    });

    const steamid = new SteamID(token.steamid64);

    this.logger.log(
      'Creating ' +
        listings.length +
        ' listing(s) for ' +
        token.steamid64 +
        '...',
    );

    const limits = await this.listingLimitsService.getLimits(steamid);

    const resources = desired.map((d) => this.getResources(steamid, d)).flat();
    const result = await this.redlock.using(resources, 10000, () => {
      // Create listings on backpack.tf
      return this._createListings(token, listings);
    });

    const createdCount = result.filter((r) => r.result !== undefined).length;

    this.logger.log(
      'Created ' + createdCount + ' listing(s) for ' + token.steamid64,
    );

    const mapped = result.reduce(
      (acc, cur, index) => {
        const hash = hashes[index];
        acc[hash] = cur;
        return acc;
      },
      {} as Record<string, BatchCreateListingResponse>,
    );

    await this.handleCreatedListings(steamid, mapped, limits);

    return result;
  }

  private async handleCreatedListings(
    steamid: SteamID,
    responses: Record<string, BatchCreateListingResponse>,
    limits: ListingLimits,
  ): Promise<void> {
    const created: Record<string, Listing> = {};
    const failed: Record<string, ListingError> = {};

    let cap: number | undefined = undefined;

    for (const hash in responses) {
      const response = responses[hash];

      if (response.result !== undefined) {
        const result = response.result;
        created[hash] = result;
      } else {
        const errorMessage = response.error?.message ?? null;

        let error: ListingError = ListingError.Unknown;

        const listingCapMatch = errorMessage?.match(
          /\((\d+)\/(\d+)\slistings\)/,
        );

        if (listingCapMatch) {
          error = ListingError.CapExceeded;

          const [, , capStr] = listingCapMatch;
          cap = parseInt(capStr);
        } else if (
          errorMessage === 'Item is invalid.' ||
          errorMessage?.startsWith('Warning: ')
        ) {
          error = ListingError.InvalidItem;
        } else if (errorMessage === '') {
          error = ListingError.ItemDoesNotExist;
        } else if (
          errorMessage === 'Listing value cannot be zero.' ||
          errorMessage === 'Cyclic currency value'
        ) {
          error = ListingError.InvalidCurrencies;
        }

        failed[hash] = error;
      }
    }

    const createdHashes = Object.keys(created);

    await this.saveTempListings(steamid, Object.values(created));

    const transaction = this.redis.multi();

    // Save current listings to database
    if (createdHashes.length > 0) {
      // Check for listings that already existed
      const existing = await this.getListingsByIds(
        steamid,
        createdHashes.map((hash) => created[hash].id),
      );

      const existingListings = new Set();

      Array.from(existing.values()).forEach((l) => {
        if (l.archived !== true) {
          existingListings.add(l.id);
        }
      });

      const newListings = createdHashes.length - existingListings.size;

      if (newListings > 0) {
        // Add new listings to old limit
        this.listingLimitsService.chainableSaveLimits(transaction, steamid, {
          used: Math.max(newListings + limits.used, 0),
        });
      }

      transaction.hmset(
        this.getCurrentKey(steamid),
        ...createdHashes.flatMap((hash) => [
          created[hash].id,
          JSON.stringify(created[hash]),
        ]),
      );
    }

    if (cap !== undefined) {
      this.listingLimitsService.chainableSaveLimits(transaction, steamid, {
        cap,
      });

      // Queue limits to be refreshed
      await this.listingLimitsService.refreshLimits(steamid);
    }

    await transaction.exec();

    const promises: Promise<unknown>[] = [];

    if (Object.keys(failed).length > 0) {
      promises.push(
        this.eventEmitter.emitAsync('current-listings.failed', {
          steamid,
          errors: failed,
        } satisfies CurrentListingsCreateFailedEvent),
      );
    }

    if (Object.keys(created).length > 0) {
      promises.push(
        this.eventEmitter.emitAsync('current-listings.created', {
          steamid,
          listings: created,
        } satisfies CurrentListingsCreatedEvent),
      );
    }

    await Promise.all(promises);
  }

  async updateListings(
    token: Token,
    desired: DesiredListing[],
  ): Promise<BatchUpdateListingResponse> {
    const listings: UpdateListingBody[] = [];

    const idToHash = new Map<string, string>();

    desired.forEach((d) => {
      const id = d.getID();
      if (!id) {
        return;
      }

      const listing = d.getListing();

      idToHash.set(id, d.getHash());
      listings.push({
        id,
        body: {
          currencies: listing.currencies,
          details: listing.details,
        },
      });
    });

    const steamid = new SteamID(token.steamid64);

    this.logger.log(
      'Updating ' +
        listings.length +
        ' listing(s) for ' +
        steamid.getSteamID64() +
        '...',
    );

    const resources = desired.map((d) => this.getResources(steamid, d)).flat();
    const result = await this.redlock.using(resources, 10000, () => {
      return this._updateListings(token, listings);
    });

    this.logger.log(
      'Updated ' + result.updated.length + ' listing(s) for ' + token.steamid64,
    );

    const updated = new Map<string, Listing>();
    result.updated.forEach((listing) => {
      updated.set(listing.id, listing);
    });

    if (updated.size !== 0) {
      // Update current listings in database
      const current = await this.getListingsByIds(
        steamid,
        Array.from(updated.keys()),
      );

      // Loop through the current listings and overwrite properties with the updated listing
      const overwritten: Listing[] = [];

      for (const id in current.keys()) {
        overwritten.push(Object.assign({}, current[id], updated.get(id)));
      }

      if (overwritten.length > 0) {
        await this.saveTempListings(steamid, overwritten);

        await this.redis.hmset(
          this.getCurrentKey(steamid),
          ...overwritten.flatMap((listing) => [
            listing.id,
            JSON.stringify(listing),
          ]),
        );
      }
    }

    const mapped = result.updated.reduce(
      (acc, cur) => {
        const hash = idToHash.get(cur.id);
        if (hash) {
          acc[hash] = cur;
        }
        return acc;
      },
      {} as Record<string, Listing>,
    );

    await this.eventEmitter.emitAsync('current-listings.updated', {
      steamid,
      listings: mapped,
    } satisfies CurrentListingsCreatedEvent);

    return result;
  }

  async deleteAllListings(token: Token): Promise<number> {
    this.logger.log('Deleting all listings for ' + token.steamid64 + '...');

    const [active, archived] = await Promise.all([
      this._deleteAllActiveListings(token),
      this._deleteAllArchivedListings(token),
    ]);

    this.logger.log(
      'Deleted ' +
        active.deleted +
        ' active and ' +
        archived.deleted +
        ' archived listing(s) for ' +
        token.steamid64,
    );

    const steamid = new SteamID(token.steamid64);

    const transaction = this.redis.multi();

    // Delete all listings in database
    transaction.del(this.getCurrentKey(steamid));

    // Clear used listings
    this.listingLimitsService.chainableClearUsed(transaction, steamid);

    await transaction.exec();

    await this.eventEmitter.emitAsync('current-listings.deleted-all', steamid);

    return active.deleted + archived.deleted;
  }

  async getListingsAndContinue(
    token: Token,
    type: JobType,
    time: number,
    skip?: number,
    limit?: number,
  ) {
    let promise: Promise<GetListingsResponse>;

    if (type === JobType.Active) {
      promise = this._getActiveListings(token, skip, limit);
    } else if (type === JobType.Archived) {
      promise = this._getArchivedListings(token, skip, limit);
    } else {
      return;
    }

    let debugStr = 'Getting ' + type + ' listings for ' + token.steamid64;

    if (skip && limit) {
      debugStr += ' using skip ' + skip + ' and limit ' + limit;
    } else if (skip) {
      debugStr += ' using skip ' + skip;
    } else if (limit) {
      debugStr += ' using limit ' + limit;
    }

    debugStr += '...';

    this.logger.debug(debugStr);

    const response = await promise;

    this.logger.debug(
      'Got response for ' +
        type +
        ' listings for ' +
        token.steamid64 +
        ': skip: ' +
        response.cursor.skip +
        ', limit: ' +
        response.cursor.limit +
        ', total: ' +
        response.cursor.total +
        ', results: ' +
        response.results.length,
    );

    const steamid = new SteamID(token.steamid64);

    if (type === JobType.Active) {
      // Update used listings using total returned in the response
      await this.listingLimitsService.saveLimits(steamid, {
        used: response.cursor.total,
      });
    }

    const resource = `bptf-manager:listings:refresh:${steamid.getSteamID64()}`;

    await this.redlock.using([resource], 5000, async (signal) => {
      const tempKey = this.getTempCurrentKey(steamid, time);

      if (response.results.length > 0) {
        await this.saveTempListings(steamid, response.results);

        // Add listings to current temp key
        await this.redis
          .multi()
          .hmset(tempKey, this.mapListings(response.results))
          // Make sure it expires after 5 minutes
          .expire(tempKey, 5 * 60)
          .exec();
      }

      if (signal.aborted) {
        throw signal.error;
      }

      if (
        response.cursor.skip + response.cursor.limit >=
        response.cursor.total
      ) {
        // Save that we are done getting listings of type
        await this.redis.set(
          this.getTempCurrentKey(steamid, time) + ':' + type + ':done',
          '1',
          'EX',
          5 * 60,
        );

        const done = await this.redis.keys(
          this.redis.options.keyPrefix +
            this.getTempCurrentKey(steamid, time) +
            ':*:done',
        );

        if (done.length < 2) {
          // Not yet done with getting all active and archived
          return;
        }

        if (signal.aborted) {
          throw signal.error;
        }

        // Check if a temp key exists
        const exists = await this.redis.exists(
          this.getTempCurrentKey(steamid, time),
        );

        const transaction = this.redis.multi();

        if (exists) {
          // It exists, copy it to the current key and remove expiration
          transaction
            .copy(
              this.getTempCurrentKey(steamid, time),
              this.getCurrentKey(steamid),
              'REPLACE',
            )
            .persist(this.getCurrentKey(steamid));
        } else {
          // It does not exist, delete current key
          transaction.del(this.getCurrentKey(steamid));
        }

        transaction.del(
          done.map((key) =>
            key.replace(this.redis.options.keyPrefix as string, ''),
          ),
        );

        await transaction.exec();

        // Publish that the listings have been refreshed (we don't delete temp key because it will expire anyway)
        await this.eventEmitter.emitAsync(
          'current-listings.refreshed',
          steamid,
        );
      } else {
        // Fetch more listings
        await this.createJob(
          steamid,
          type,
          time,
          response.cursor.skip + response.cursor.limit,
          response.cursor.limit,
        );
      }
    });

    return response;
  }

  private async saveTempListings(
    steamid: SteamID,
    listings: Listing[],
  ): Promise<void> {
    if (listings.length === 0) {
      return;
    }

    const keys = await this.redis.keys(this.getTempCurrentKey(steamid, '*'));

    const transaction = this.redis.multi();

    // Add listings to all temp keys for this steamid
    keys.forEach((key) => {
      transaction.hmset(key, this.mapListings(listings));
    });

    await transaction.exec();
  }

  private async deleteTempListings(
    steamid: SteamID,
    ids: string[],
  ): Promise<void> {
    if (ids.length === 0) {
      return;
    }

    const keys = await this.redis.keys(this.getTempCurrentKey(steamid, '*'));

    const transaction = this.redis.multi();

    // Add listings to all temp keys for this steamid
    keys.forEach((key) => {
      transaction.hdel(key, ...ids);
    });

    await transaction.exec();
  }

  private mapListings(listings: Listing[]): Record<string, string> {
    const mapped: Record<string, string> = {};

    listings.forEach((listing) => {
      mapped[listing.id] = JSON.stringify(listing);
    });

    return mapped;
  }

  private _createListings(
    token: Token,
    listings: ListingDto[],
  ): Promise<BatchCreateListingResponse[]> {
    return firstValueFrom(
      this.httpService.post<BatchCreateListingResponse[]>(
        'https://api.backpack.tf/api/v2/classifieds/listings/batch',
        listings,
        {
          headers: {
            'X-Auth-Token': token.value,
          },
          timeout: 60000,
        },
      ),
    ).then((response) => {
      return response.data;
    });
  }

  private _updateListings(
    token: Token,
    listings: UpdateListingBody[],
  ): Promise<BatchUpdateListingResponse> {
    return firstValueFrom(
      this.httpService.patch<BatchUpdateListingResponse>(
        'https://api.backpack.tf/api/v2/classifieds/listings/batch',
        listings,
        {
          headers: {
            'X-Auth-Token': token.value,
          },
          timeout: 60000,
        },
      ),
    ).then((response) => {
      return response.data;
    });
  }

  private _deleteListings(
    token: Token,
    ids: string[],
  ): Promise<DeleteListingsResponse> {
    return firstValueFrom(
      this.httpService.delete<DeleteListingsResponse>(
        'https://api.backpack.tf/api/classifieds/delete/v1',
        {
          data: {
            listing_ids: ids,
          },
          headers: {
            'X-Auth-Token': token.value,
          },
          timeout: 60000,
        },
      ),
    ).then((response) => {
      return response.data;
    });
  }

  private _deleteArchivedListings(
    token: Token,
    ids: string[],
  ): Promise<BatchDeleteListingResponse> {
    return firstValueFrom(
      this.httpService.delete<BatchDeleteListingResponse>(
        'https://api.backpack.tf/api/v2/classifieds/archive/batch',
        {
          data: {
            ids,
          },
          headers: {
            'X-Auth-Token': token.value,
          },
          timeout: 60000,
        },
      ),
    ).then((response) => {
      return response.data;
    });
  }

  private _deleteAllActiveListings(
    token: Token,
  ): Promise<DeleteAllListingsResponse> {
    return firstValueFrom(
      this.httpService.delete<DeleteAllListingsResponse>(
        'https://api.backpack.tf/api/v2/classifieds/listings',
        {
          headers: {
            'X-Auth-Token': token.value,
          },
          timeout: 60000,
        },
      ),
    ).then((response) => {
      return response.data;
    });
  }

  private _deleteAllArchivedListings(
    token: Token,
  ): Promise<DeleteAllListingsResponse> {
    return firstValueFrom(
      this.httpService.delete<DeleteAllListingsResponse>(
        'https://api.backpack.tf/api/v2/classifieds/archive',
        {
          headers: {
            'X-Auth-Token': token.value,
          },
          timeout: 60000,
        },
      ),
    ).then((response) => {
      return response.data;
    });
  }

  private _getActiveListings(
    token: Token,
    skip?: number,
    limit = 1000,
  ): Promise<GetListingsResponse> {
    return firstValueFrom(
      this.httpService.get<GetListingsResponse>(
        'https://api.backpack.tf/api/v2/classifieds/listings',
        {
          params: {
            skip,
            limit,
          },
          headers: {
            'X-Auth-Token': token.value,
          },
          timeout: 60000,
        },
      ),
    ).then((response) => {
      return response.data;
    });
  }

  private _getArchivedListings(
    token: Token,
    skip?: number,
    limit = 1000,
  ): Promise<GetListingsResponse> {
    return firstValueFrom(
      this.httpService.get<GetListingsResponse>(
        'https://api.backpack.tf/api/v2/classifieds/archive',
        {
          params: {
            skip,
            limit,
          },
          headers: {
            'X-Auth-Token': token.value,
          },
          timeout: 60000,
        },
      ),
    ).then((response) => {
      return response.data;
    });
  }

  private getCurrentKey(steamid: SteamID): string {
    return `${KEY_PREFIX}listings:current:${steamid.getSteamID64()}`;
  }

  private getTempCurrentKey(steamid: SteamID, time: number | '*'): string {
    return this.getCurrentKey(steamid) + ':' + time;
  }

  getCurrentShouldNotDeleteEntryKey(steamid: SteamID): string {
    return `${KEY_PREFIX}listings:current:keep:${steamid.getSteamID64()}`;
  }

  private getResources(steamid: SteamID, desired: DesiredListing): string[] {
    const resources = [this.getResourceForDesired(steamid, desired)];

    const id = desired.getID();
    if (id) {
      resources.push(this.getResourceForListingId(steamid, id));
    }

    return resources;
  }

  private getResourceForListingId(steamid: SteamID, id: string): string {
    return `bptf-manager:current:${steamid.getSteamID64()}:${id}`;
  }

  private getResourceForDesired(
    steamid: SteamID,
    desired: DesiredListing,
  ): string {
    return `bptf-manager:current:${steamid.getSteamID64()}:${desired.getHash()}`;
  }
}

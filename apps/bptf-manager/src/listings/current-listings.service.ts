import { InjectRedis } from '@songkeys/nestjs-redis';
import { Listing, ListingDto, Token } from '@tf2-automatic/bptf-manager-data';
import { Redis } from 'ioredis';
import {
  BatchCreateListingResponse,
  BatchDeleteListingResponse,
  DeleteAllListingsResponse,
  DeleteListingsResponse,
} from './interfaces/bptf-response.interface';
import { firstValueFrom } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import { EventEmitter2 } from '@nestjs/event-emitter';
import SteamID from 'steamid';
import {
  DesiredListing,
  ListingError,
} from './interfaces/desired-listing.interface';
import {
  CurrentListingsCreateFailedEvent,
  CurrentListingsCreatedEvent,
  CurrentListingsDeletedEvent,
} from './interfaces/events.interface';
import { Logger } from '@nestjs/common';
import { ListingLimitsService } from './listing-limits.service';
import { ListingLimits } from './interfaces/limits.interface';

const KEY_PREFIX = 'bptf-manager:data:';

export class CurrentListingsService {
  private readonly logger = new Logger(CurrentListingsService.name);

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly httpService: HttpService,
    private readonly eventEmitter: EventEmitter2,
    private readonly listingLimitsService: ListingLimitsService,
  ) {}

  async getAllCurrent(steamid: SteamID): Promise<Listing[]> {
    const values = await this.redis.hvals(this.getCurrentKey(steamid));

    return values.map((raw) => {
      return JSON.parse(raw) as Listing;
    });
  }

  async getListingsByIds(
    steamid: SteamID,
    ids: string[],
  ): Promise<Record<string, Listing>> {
    if (ids.length === 0) {
      return {};
    }

    const values = await this.redis.hmget(this.getCurrentKey(steamid), ...ids);

    const result: Record<string, Listing> = {};

    values.forEach((raw) => {
      if (raw === null) {
        return;
      }

      const listing = JSON.parse(raw) as Listing;

      result[listing.id] = listing;
    });

    return result;
  }

  async deleteListings(token: Token, ids: string[]) {
    this.logger.log(
      'Deleting ' +
        ids.length +
        ' active listing(s) for ' +
        token.steamid64 +
        '...',
    );

    const steamid = new SteamID(token.steamid64);

    // Figure out what listings should be deleted from the database
    const exists = await this.redis.smismember(
      this.getCurrentShouldNotDeleteEntryKey(steamid),
      ...ids,
    );

    const limits = await this.listingLimitsService.getLimits(steamid);

    // Delete listings on backpack.tf
    const result = await this._deleteListings(token, ids);

    this.logger.log('Deleted ' + result.deleted + ' active listing(s)');

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
    } satisfies CurrentListingsDeletedEvent);

    return result;
  }

  async deleteArchivedListings(token: Token, ids: string[]) {
    this.logger.log(
      'Deleting ' +
        ids.length +
        ' archived listing(s) for ' +
        token.steamid64 +
        '...',
    );

    // Delete listings on backpack.tf
    const result = await this._deleteArchivedListings(token, ids);

    this.logger.log('Deleted ' + result.deleted + ' archived listing(s)');

    const steamid = new SteamID(token.steamid64);

    // Delete current listings in database
    await this.redis.hdel(this.getCurrentKey(steamid), ...ids);

    // Publish that the listings have been deleted
    await this.eventEmitter.emitAsync('current-listings.deleted', {
      steamid,
      ids,
    } satisfies CurrentListingsDeletedEvent);

    return result;
  }

  async createListings(token: Token, desired: DesiredListing[]) {
    const listings: ListingDto[] = [];
    const hashes: string[] = [];

    desired.forEach((d) => {
      listings.push(d.listing);
      hashes.push(d.hash);
    });

    this.logger.log(
      'Creating ' +
        listings.length +
        ' listing(s) for ' +
        token.steamid64 +
        '...',
    );

    const limits = await this.listingLimitsService.getLimits(
      new SteamID(token.steamid64),
    );

    // Create listings on backpack.tf
    const result = await this._createListings(token, listings);

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

    await this.handleCreatedListings(
      new SteamID(token.steamid64),
      mapped,
      limits,
    );

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

    const transaction = this.redis.multi();

    // Save current listings to database
    if (createdHashes.length > 0) {
      // Check for listings that already existed
      const existing = await this.getListingsByIds(
        steamid,
        createdHashes.map((hash) => created[hash].id),
      );

      const existingListings = new Set();

      Object.values(existing).forEach((l) => {
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

      await transaction.hmset(
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
          results: failed,
        } satisfies CurrentListingsCreateFailedEvent),
      );
    }

    if (Object.keys(created).length > 0) {
      promises.push(
        this.eventEmitter.emitAsync('current-listings.created', {
          steamid,
          results: created,
        } satisfies CurrentListingsCreatedEvent),
      );
    }

    await Promise.all(promises);
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

  _createListings(
    token: Token,
    listings: ListingDto[],
  ): Promise<BatchCreateListingResponse[]> {
    return firstValueFrom(
      this.httpService.post<BatchCreateListingResponse[]>(
        'https://backpack.tf/api/v2/classifieds/listings/batch',
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

  _deleteListings(
    token: Token,
    ids: string[],
  ): Promise<DeleteListingsResponse> {
    return firstValueFrom(
      this.httpService.delete<DeleteListingsResponse>(
        'https://backpack.tf/api/classifieds/delete/v1',
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

  _deleteArchivedListings(
    token: Token,
    ids: string[],
  ): Promise<BatchDeleteListingResponse> {
    return firstValueFrom(
      this.httpService.delete<BatchDeleteListingResponse>(
        'https://backpack.tf/api/v2/classifieds/archive/batch',
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

  _deleteAllActiveListings(token: Token): Promise<DeleteAllListingsResponse> {
    return firstValueFrom(
      this.httpService.delete<DeleteAllListingsResponse>(
        'https://backpack.tf/api/v2/classifieds/listings',
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

  _deleteAllArchivedListings(token: Token): Promise<DeleteAllListingsResponse> {
    return firstValueFrom(
      this.httpService.delete<DeleteAllListingsResponse>(
        'https://backpack.tf/api/v2/classifieds/archive',
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

  private getCurrentKey(steamid: SteamID): string {
    return `${KEY_PREFIX}listings:current:${steamid.getSteamID64()}`;
  }

  getCurrentShouldNotDeleteEntryKey(steamid: SteamID): string {
    return `${KEY_PREFIX}listings:current:keep:${steamid.getSteamID64()}`;
  }
}

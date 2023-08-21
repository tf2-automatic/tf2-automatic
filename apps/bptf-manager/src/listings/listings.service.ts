import { Injectable, NotFoundException } from '@nestjs/common';
import {
  DesiredListingDto,
  ListingDto,
  DesiredListing,
  Listing,
  Token,
} from '@tf2-automatic/bptf-manager-data';
import SteamID from 'steamid';
import hash from 'object-hash';
import { ChainableCommander, Redis } from 'ioredis';
import { InjectRedis } from '@songkeys/nestjs-redis';
import {
  DesiredListing as DesiredListingInternal,
  ListingError,
} from './interfaces/desired-listing.interface';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import {
  BatchCreateListingResponse,
  BatchDeleteListingResponse,
  DeleteAllListingsResponse,
  DeleteListingsResponse,
  ListingLimitsResponse,
} from './interfaces/bptf-response.interface';
import Redlock from 'redlock';
import {
  JobData as ManageJobData,
  JobName as ManageJobName,
  JobResult as ManageJobResult,
  JobType as ManageJobType,
} from './interfaces/manage-listings-queue.interface';
import { AgentsService } from '../agents/agents.service';
import { OnEvent } from '@nestjs/event-emitter';
import { ListingLimits } from './interfaces/limits.interface';

const KEY_PREFIX = 'bptf-manager:data:';

@Injectable()
export class ListingsService {
  private readonly redlock: Redlock;

  constructor(
    private readonly httpService: HttpService,
    @InjectQueue('manage-listings')
    private readonly manageListingsQueue: Queue<
      ManageJobData,
      ManageJobResult,
      ManageJobName
    >,
    @InjectQueue('listing-limits')
    private readonly listingLimitsQueue: Queue,
    @InjectRedis() private readonly redis: Redis,
    private readonly agentsService: AgentsService,
  ) {
    this.redlock = new Redlock([redis]);
  }

  @OnEvent('agents.registering')
  private async startCreatingListings(steamid: SteamID): Promise<void> {
    // TODO: Queue a job to compare current listings to desired listings and create/delete listings based on that

    const desired = await this.getAllDesired(steamid);

    if (desired.length > 0) {
      // Queue all desired listings
      await this.redis.zadd(
        this.getCreateKey(steamid),
        ...desired.flatMap((d) => [
          d.priority ?? Number.MAX_SAFE_INTEGER,
          d.hash,
        ]),
      );
    }

    return this.createManageListingsJob(steamid, ManageJobType.Create);
  }

  @OnEvent('agents.unregistering')
  private async startDeletingListings(steamid: SteamID): Promise<void> {
    await this.createManageListingsJob(steamid, ManageJobType.DeleteAll);
  }

  async addDesired(
    steamid: SteamID,
    dto: DesiredListingDto[],
  ): Promise<DesiredListing[]> {
    const now = Math.floor(Date.now() / 1000);

    const desired: DesiredListingInternal[] = dto.map((create) => {
      const obj: DesiredListingInternal = {
        hash: this.createHash(create.listing),
        steamid64: steamid.getSteamID64(),
        listing: create.listing,
        updatedAt: now,
      };

      if (create.priority !== undefined) {
        obj.priority = create.priority;
      }

      return obj;
    });

    return this.redlock.using(
      ['listings:' + steamid.getSteamID64()],
      1000,
      async (signal) => {
        // Get current listings and check if they are different from the new listings
        const current = await this.getDesired(
          steamid,
          // Only get listings that are not forced
          desired.filter((d, i) => dto[i].force !== true).map((d) => d.hash),
        );

        if (signal.aborted) {
          throw signal.error;
        }

        desired.forEach((d) => {
          // Update desired based on current listings
          const c = current[d.hash];

          if (c) {
            // Need to ignore types because new listings have DesiredListing type and current listings are a normal object
            const currentHash = hash(c.listing, {
              respectType: false,
            });
            const newHash = hash(d.listing, {
              respectType: false,
            });

            if (currentHash === newHash) {
              // Listings are the same so keep some properties
              d.id = c.id;
              d.error = c.error;
              d.lastAttemptedAt = c.lastAttemptedAt;
            }
          }
        });

        // The listings without an id needs to be created
        const queue = desired.filter((d) => d.id === undefined);

        const transaction = this.redis.multi();

        this.chainableSaveDesired(transaction, steamid, desired);
        this.chainableRemoveDeleteQueue(
          transaction,
          steamid,
          desired.map((d) => d.hash),
        );

        if (queue.length > 0) {
          // Add to the create queue
          this.chainableCreateDesired(transaction, steamid, queue);
        }

        await transaction.exec();

        if (queue.length > 0) {
          // Add job to create listings (ignore errors)
          await Promise.allSettled([
            this.createManageListingsJob(steamid, ManageJobType.Create),
          ]);
        }

        return this.mapDesired(desired);
      },
    );
  }

  async removeDesired(steamid: SteamID, listings: ListingDto[]): Promise<void> {
    const hashes = listings.map((listing) => this.createHash(listing));

    return this.redlock.using(
      ['listings:' + steamid.getSteamID64()],
      1000,
      async (signal) => {
        const desiredMap = await this.getDesired(steamid, hashes);

        if (signal.aborted) {
          throw signal.error;
        }

        const desired = Object.values(desiredMap);
        if (desired.length > 0) {
          // It is okay to only remove the matched listings because unmatched listings don't exist anyway
          const transaction = this.redis.multi();
          this.chainableDeleteDesired(transaction, steamid, desired);
          await transaction.exec();

          await Promise.allSettled([
            this.createManageListingsJob(steamid, ManageJobType.DeleteArchived),
            this.createManageListingsJob(steamid, ManageJobType.Delete),
          ]);
        }
      },
    );
  }

  // TODO: Add pagination
  async getAllDesired(steamid: SteamID): Promise<DesiredListingInternal[]> {
    const values = await this.redis.hvals(this.getDesiredKey(steamid));

    return values.map((v) => JSON.parse(v));
  }

  async getDesired(
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

  async getCurrent(steamid: SteamID): Promise<Listing[]> {
    const values = await this.redis.hvals(this.getCurrentKey(steamid));

    return values.map((v) => JSON.parse(v));
  }

  async getLimits(steamid: SteamID): Promise<ListingLimits> {
    const current = await this.redis.get(this.getLimitsKey(steamid));

    if (current === null) {
      throw new NotFoundException('Listing limits not found');
    }

    return JSON.parse(current);
  }

  @OnEvent('agents.registered')
  async refreshLimits(steamid: SteamID): Promise<void> {
    await this.listingLimitsQueue.add(
      'refresh',
      {
        steamid64: steamid.getSteamID64(),
      },
      {
        jobId: 'refresh:' + steamid.getSteamID64(),
      },
    );
  }

  async saveLimits(
    steamid: SteamID,
    limits: ListingLimitsResponse,
  ): Promise<void> {
    const save: ListingLimits = {
      listings: limits.listings.total,
      promoted: limits.listings.promotionSlotsAvailable,
      updatedAt: Math.floor(Date.now() / 1000),
    };
    await this.redis.set(this.getLimitsKey(steamid), JSON.stringify(save));
  }

  async createManageListingsJob(
    steamid: SteamID,
    type: ManageJobType,
  ): Promise<void> {
    if (type === 'create') {
      const registering = await this.agentsService.isRegistering(steamid);
      if (!registering) {
        // Agent is not running, don't create the job for creating listings
        return;
      }
    }

    let priority: number | undefined;

    switch (type) {
      case ManageJobType.Delete:
        priority = 3;
        break;
      case ManageJobType.DeleteArchived:
        priority = 2;
        break;
      case ManageJobType.Create:
        priority = 4;
        break;
      case ManageJobType.DeleteAll:
        priority = 1;
        break;
    }

    await this.manageListingsQueue.add(
      type,
      {
        steamid64: steamid.getSteamID64(),
      },
      {
        jobId: type + ':' + steamid.getSteamID64(),
        priority,
      },
    );
  }

  getHashesToCreate(steamid: SteamID, count: number): Promise<string[]> {
    return this.redis.zrange(this.getCreateKey(steamid), 0, count - 1);
  }

  getListingIdsToDelete(steamid: SteamID, count: number): Promise<string[]> {
    return this.redis.srandmember(this.getDeleteKey(steamid), count);
  }

  getArchivedListingIdsToDelete(
    steamid: SteamID,
    count: number,
  ): Promise<string[]> {
    return this.redis.srandmember(this.getArchivedDeleteKey(steamid), count);
  }

  async handleCreatedListings(
    steamid: SteamID,
    hashes: string[],
    result: BatchCreateListingResponse[],
  ): Promise<void> {
    const now = Math.floor(Date.now() / 1000);

    const created: Record<string, Listing> = {};
    const updated: Record<string, Listing> = {};
    const failed: Record<string, string | null> = {};

    // Figure out which listings were created and which weren't
    result.forEach((e, i) => {
      if (e.result !== undefined) {
        if (e.result.listedAt > e.result.bumpedAt) {
          updated[hashes[i]] = e.result;
        } else {
          created[hashes[i]] = e.result;
        }
      } else {
        failed[hashes[i]] = e.error?.message ?? null;
      }
    });

    const transaction = this.redis.multi();

    const failedHashes = Object.keys(failed);

    // Update failed listings
    if (failedHashes.length > 0) {
      // Update the failed desired listings with the error message
      const desiredMap = await this.getDesired(steamid, failedHashes);

      const desired = Object.values(desiredMap);
      desired.forEach((desired) => {
        desired.updatedAt = now;
        desired.lastAttemptedAt = now;

        const errorMessage = failed[desired.hash];

        let error: ListingError = ListingError.Unknown;

        if (
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
        } else if (
          errorMessage?.startsWith('Your listing cap has been reached')
        ) {
          // Don't mark listing cap as an error because it should be handled by the system
          return;
        }

        desired.error = error;
      });

      this.chainableSaveDesired(transaction, steamid, desired);
    }

    const changed = Object.assign({}, created, updated);
    const changedHashes = Object.keys(changed);

    // Update overwritten listings
    if (changedHashes.length > 0) {
      // Check for listings that were overwritten

      const ids = Object.values(changed).map((l) => l.id);

      // Get listings by listing id
      const hashes = (
        await this.redis.hmget(this.getHashFromListingKey(steamid), ...ids)
      ).filter((m): m is string => m !== null);

      if (hashes.length > 0) {
        const desiredMap = await this.getDesired(steamid, hashes);

        const desired = Object.values(desiredMap);
        desired.forEach((desired) => {
          desired.updatedAt = now;
          desired.error = ListingError.Overwritten;
          delete desired.id;
        });

        if (desired.length > 0) {
          this.chainableSaveDesired(transaction, steamid, desired);
        }
      }
    }

    // Update desired listings that were changed
    if (changedHashes.length > 0) {
      const desiredMap = await this.getDesired(steamid, changedHashes);

      const desired = Object.values(desiredMap);
      desired.forEach((desired) => {
        desired.id = changed[desired.hash].id;
        desired.lastAttemptedAt = now;
        desired.updatedAt = now;
      });

      if (desired.length > 0) {
        // Save listings with their new listings id
        this.chainableSaveDesired(transaction, steamid, desired);
      }

      const archivedIds = changedHashes
        .filter((hash) => changed[hash].archived === true)
        .map((hash) => changed[hash].id);

      if (archivedIds.length > 0) {
        // Attempt to delete active listings using the archived listing ids
        // because we don't want to have both an active and archived lisitng
        // at the same time.
        this.chainableAddDeleteQueue(transaction, steamid, archivedIds);
      }

      // Save backpack.tf listings
      this.chainableSaveListings(transaction, steamid, changed);
    }

    this.chainableRemoveCreateQueue(transaction, steamid, hashes);

    await transaction.exec();
  }

  async handleDeletedListings(steamid: SteamID, ids: string[]): Promise<void> {
    // It is not nessesary or easily possible to remove listing ids from the desired listings
    // because they are already deleted
    await this.redlock.using(
      ['listings:' + steamid.getSteamID64()],
      5000,
      async () => {
        await this.redis
          .multi()
          // Remove ids from queue
          .srem(this.getDeleteKey(steamid), ...ids)
          // Remove listings
          .hdel(this.getCurrentKey(steamid), ...ids)
          .exec();
      },
    );
  }

  async handleDeletedAllListings(steamid: SteamID) {
    await this.redlock.using(
      ['listings:' + steamid.getSteamID64()],
      5000,
      async () => {
        const now = Math.floor(Date.now() / 1000);

        const desired = await this.getAllDesired(steamid);

        const transaction = this.redis
          .multi()
          // Remove current listings
          .del(this.getCurrentKey(steamid))
          // Clear delete queue
          .del(this.getDeleteKey(steamid));

        if (desired.length > 0) {
          const updated: Record<string, string> = {};

          desired.forEach((d) => {
            delete d.id;
            d.updatedAt = now;
            updated[d.hash] = JSON.stringify(d);
          });

          // Update desired listings by removing the listing id for non-archived listings
          transaction.hset(this.getDesiredKey(steamid), updated);
        }

        await transaction.exec();
      },
    );
  }

  async handleDeletedArchivedListings(
    steamid: SteamID,
    ids: string[],
  ): Promise<void> {
    await this.redlock.using(
      ['listings:' + steamid.getSteamID64()],
      5000,
      async () => {
        await this.redis
          .multi()
          // Remove ids from queue
          .srem(this.getArchivedDeleteKey(steamid), ...ids)
          // Remove listings
          .hdel(this.getCurrentKey(steamid), ...ids)
          .exec();
      },
    );
  }

  /**
   * Add desired listings to create queue
   */
  private chainableCreateDesired(
    chainable: ChainableCommander,
    steamid: SteamID,
    desired: DesiredListingInternal[],
  ): void {
    chainable.zadd(
      this.getCreateKey(steamid),
      ...desired.flatMap((d) => [
        d.priority ?? Number.MAX_SAFE_INTEGER,
        d.hash,
      ]),
    );
  }

  private chainableAddDeleteQueue(
    chainable: ChainableCommander,
    steamid: SteamID,
    ids: string[],
  ): void {
    chainable.sadd(this.getDeleteKey(steamid), ...ids);
  }

  /**
   * Save desired listings
   */
  private chainableSaveDesired(
    chainable: ChainableCommander,
    steamid: SteamID,
    desired: DesiredListingInternal[],
  ): void {
    chainable
      // Add to the desired listings hash
      .hset(
        this.getDesiredKey(steamid),
        ...desired.flatMap((d) => [d.hash, JSON.stringify(d)]),
      )
      // Remove from the delete queue
      .srem(this.getDeleteKey(steamid), ...desired.map((d) => d.hash));
  }

  /**
   * Remove desired listings from delete queue
   */
  private chainableRemoveDeleteQueue(
    chainable: ChainableCommander,
    steamid: SteamID,
    hashes: string[],
  ): void {
    chainable.srem(this.getDeleteKey(steamid), ...hashes);
  }

  /**
   * Delete desired listings
   */
  private chainableDeleteDesired(
    chainable: ChainableCommander,
    steamid: SteamID,
    desired: DesiredListingInternal[],
  ): void {
    const hashes = desired.map((d) => d.hash);

    chainable
      // Remove from the desired listings hash
      .hdel(this.getDesiredKey(steamid), ...hashes);

    // Remove hashes from the create queue
    this.chainableRemoveCreateQueue(chainable, steamid, hashes);

    const ids = desired.filter((d) => d.id !== undefined).map((d) => d.id!);
    if (ids.length > 0) {
      // Add ids to the delete queue
      this.chainableAddDeleteQueue(chainable, steamid, ids);
      chainable.sadd(this.getArchivedDeleteKey(steamid), ...ids);
    }
  }

  /**
   * Remove desired listings from create queue
   */
  private chainableRemoveCreateQueue(
    chainable: ChainableCommander,
    steamid: SteamID,
    hashes: string[],
  ): void {
    chainable.zrem(this.getCreateKey(steamid), ...hashes);
  }

  private chainableSaveListings(
    chainable: ChainableCommander,
    steamid: SteamID,
    listings: Record<string, Listing>,
  ): void {
    chainable
      // Save listings
      .hset(
        this.getCurrentKey(steamid),
        ...Object.values(listings).flatMap((listing) => [
          listing.id,
          JSON.stringify(listing),
        ]),
      )
      // Remove from the delete queue
      .srem(this.getDeleteKey(steamid), ...Object.keys(listings));
  }

  createListings(
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

  deleteListings(token: Token, ids: string[]): Promise<DeleteListingsResponse> {
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

  deleteArchivedListings(
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

  deleteAllListings(token: Token): Promise<DeleteAllListingsResponse> {
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

  deleteAllArchivedListings(token: Token): Promise<DeleteAllListingsResponse> {
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

  mapDesired(desired: DesiredListingInternal[]): DesiredListing[] {
    return desired.map((d) => ({
      id: d.id ?? null,
      listing: d.listing,
      priority: d.priority,
      error: d.error,
      lastAttemptedAt: d.lastAttemptedAt,
      updatedAt: d.updatedAt,
    }));
  }

  private createHash(listing: ListingDto): string {
    if (listing.id) {
      return hash(listing.id);
    }

    return hash(listing.item!);
  }

  private getDesiredKey(steamid: SteamID): string {
    return `${KEY_PREFIX}listings:desired:${steamid.getSteamID64()}`;
  }

  private getCurrentKey(steamid: SteamID): string {
    return `${KEY_PREFIX}listings:current:${steamid.getSteamID64()}`;
  }

  private getCreateKey(steamid: SteamID): string {
    return `${KEY_PREFIX}listings:create:${steamid.getSteamID64()}`;
  }

  private getDeleteKey(steamid: SteamID): string {
    return `${KEY_PREFIX}listings:delete:${steamid.getSteamID64()}`;
  }

  private getArchivedDeleteKey(steamid: SteamID): string {
    return `${KEY_PREFIX}listings:delete:archived:${steamid.getSteamID64()}`;
  }

  private getHashFromListingKey(steamid: SteamID): string {
    return `${KEY_PREFIX}listings:hash:${steamid.getSteamID64()}`;
  }

  private getLimitsKey(steamid: SteamID): string {
    return `${KEY_PREFIX}listings:limits:${steamid.getSteamID64()}`;
  }
}

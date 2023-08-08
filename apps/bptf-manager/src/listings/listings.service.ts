import { Injectable } from '@nestjs/common';
import {
  DesiredListingDto,
  ListingDto,
  DesiredListing,
  Listing,
  Token,
} from '@tf2-automatic/bptf-manager-data';
import SteamID from 'steamid';
import hash from 'object-hash';
import { Redis } from 'ioredis';
import { InjectRedis } from '@songkeys/nestjs-redis';
import { DesiredListing as DesiredListingInternal } from './interfaces/desired-listing.interface';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import {
  BatchCreateListingResponse,
  BatchDeleteListingResponse,
  DeleteAllListingsResponse,
  DeleteListingsResponse,
} from './interfaces/bptf-response.interface';
import Redlock from 'redlock';
import { JobData, JobName, JobResult } from './interfaces/queue.interface';
import { AgentsService } from '../agents/agents.service';
import { OnEvent } from '@nestjs/event-emitter';

const KEY_PREFIX = 'bptf-manager:data:';

@Injectable()
export class ListingsService {
  private readonly redlock: Redlock;

  constructor(
    private readonly httpService: HttpService,
    @InjectQueue('listings')
    private readonly listingsQueue: Queue<JobData, JobResult, JobName>,
    @InjectRedis() private readonly redis: Redis,
    private readonly agentsService: AgentsService,
  ) {
    this.redlock = new Redlock([redis]);
  }

  @OnEvent('agents.registering')
  async startCreatingListings(steamid: SteamID): Promise<void> {
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

    return this.createJob(steamid, 'create');
  }

  @OnEvent('agents.unregistering')
  async startDeletingListings(steamid: SteamID): Promise<void> {
    await Promise.all([
      this.createJob(steamid, 'deleteAll'),
      this.createJob(steamid, 'deleteAllArchived'),
    ]);
  }

  async createJob(
    steamid: SteamID,
    type:
      | 'delete'
      | 'create'
      | 'deleteArchived'
      | 'deleteAll'
      | 'deleteAllArchived',
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
      case 'delete':
        priority = 3;
        break;
      case 'deleteArchived':
        priority = 2;
        break;
      case 'create':
        priority = 4;
        break;
      case 'deleteAll':
      case 'deleteAllArchived':
        priority = 1;
        break;
    }

    await this.listingsQueue.add(
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

  async addDesired(
    steamid: SteamID,
    dto: DesiredListingDto[],
  ): Promise<DesiredListing[]> {
    const now = Math.floor(Date.now() / 1000);

    const hashes = dto.map((create) => this.createHash(create.listing));

    const desired: DesiredListingInternal[] = dto.map((create, index) => {
      const obj: DesiredListingInternal = {
        hash: hashes[index],
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
      async () => {
        // TODO: Only get desired of the listings that are not forced to be created
        const currentDesired = await this.getDesired(steamid, hashes);

        desired.forEach((d, index) => {
          if (dto[index].force === true) {
            // Listing is forced to be created so we don't care about the current listing
            return;
          }

          const current = currentDesired[index];

          // Check if a current listing exists, if it has an id, and if the raw listings match
          if (
            current !== null &&
            hash(current.listing, {
              respectType: false,
            }) ===
              hash(d.listing, {
                respectType: false,
              })
          ) {
            // Listings are the same so keep some properties
            d.id = current.id;
            d.archived = current.archived;
          }

          return d;
        });

        const desiredToQueue = desired.filter((d) => d.id === undefined);

        const transaction = this.redis.multi();

        transaction
          // Add to the desired listings hash
          .hset(
            this.getDesiredKey(steamid),
            ...desired.flatMap((d) => [d.hash, JSON.stringify(d)]),
          )
          // Remove from the delete queue
          .srem(this.getDeleteKey(steamid), ...hashes);

        if (desiredToQueue.length > 0) {
          // Add to the create queue
          transaction.zadd(
            this.getCreateKey(steamid),
            ...desiredToQueue.flatMap((d) => [
              d.priority ?? Number.MAX_SAFE_INTEGER,
              d.hash,
            ]),
          );
        }

        await transaction.exec();

        if (desiredToQueue.length > 0) {
          // Add job to create listings (ignore errors)
          await this.createJob(steamid, 'create').catch(() => {
            // Ignore error
          });
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
        const desired = await this.getDesired(steamid, hashes);

        const matches = desired.filter(
          (d): d is DesiredListingInternal => d !== null && d.id !== undefined,
        );

        const listingIds = matches.map((d) => d.id!);
        const archivedListingIds = matches
          .filter((d) => d.archived === true)
          .map((d) => d.id!);

        if (signal.aborted) {
          throw signal.error;
        }

        const transaction = this.redis.multi();

        transaction
          // Remove hashes from the desired listings hash
          .hdel(this.getDesiredKey(steamid), ...hashes)
          // Remove hashes from the create queue
          .zrem(this.getCreateKey(steamid), ...hashes);

        if (listingIds.length > 0) {
          transaction
            // Add ids to the delete queue
            .sadd(this.getDeleteKey(steamid), ...listingIds);
        }

        if (archivedListingIds.length > 0) {
          transaction
            // Add ids to the archived delete queue
            .sadd(this.getArchivedDeleteKey(steamid), ...archivedListingIds);
        }

        await transaction.exec();

        const promises: Promise<void>[] = [];

        if (archivedListingIds.length > 0) {
          // Add jobs to delete archived listings
          promises.push(this.createJob(steamid, 'deleteArchived'));
        }

        if (listingIds.length > 0) {
          // Add jobs to delete listings
          promises.push(this.createJob(steamid, 'delete'));
        }

        await Promise.allSettled(promises);
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
  ): Promise<(DesiredListingInternal | null)[]> {
    if (hashes.length === 0) {
      return [];
    }

    const values = await this.redis.hmget(
      this.getDesiredKey(steamid),
      ...hashes,
    );

    return values.map((desired) =>
      desired === null ? null : JSON.parse(desired),
    );
  }

  async getCurrent(steamid: SteamID): Promise<Listing[]> {
    const values = await this.redis.hvals(this.getCurrentKey(steamid));

    return values.map((v) => JSON.parse(v));
  }

  async getCurrentByIds(
    steamid: SteamID,
    ids: string[],
  ): Promise<(Listing | null)[]> {
    if (ids.length === 0) {
      return [];
    }

    const values = await this.redis.hmget(this.getCurrentKey(steamid), ...ids);

    return values.map((current) =>
      current === null ? null : JSON.parse(current),
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
    created: Record<string, Listing>,
    updated: Record<string, Listing>,
    failed: Record<string, string | null>,
  ): Promise<void> {
    const now = Math.floor(Date.now() / 1000);

    const changed = Object.assign({}, created, updated);

    await this.redlock.using(
      ['listings:' + steamid.getSteamID64()],
      5000,
      async (signal) => {
        // Check for failed listings
        if (Object.keys(failed).length > 0) {
          // Set failed message
          const desired = await this.getDesired(steamid, Object.keys(failed));

          if (signal.aborted) {
            throw signal.error;
          }

          // Filter out null values and add the error message
          const set = desired
            .filter((d): d is DesiredListingInternal => d !== null)
            .map((d) => {
              if (d) {
                d.message = failed[d.hash] ?? 'Unknown error';
              }

              return d;
            });

          if (set.length > 0) {
            // Overwrite the desired listings with the error message
            await this.redis
              .multi()
              .hset(
                this.getDesiredKey(steamid),
                ...set.flatMap((d) => [d.hash, JSON.stringify(d)]),
              ) // Remove hashes from the create queue
              .zrem(this.getCreateKey(steamid), ...Object.keys(failed))
              .exec();

            if (signal.aborted) {
              throw signal.error;
            }
          }
        }

        const hashes = Object.keys(changed);

        if (hashes.length > 0) {
          // Check for listings that were overwritten

          // Get hash of listings using the listing ids
          const matches = await this.redis.hmget(
            this.getHashFromListingKey(steamid),
            ...Object.values(changed).map((l) => l.id),
          );

          if (signal.aborted) {
            throw signal.error;
          }

          if (matches.length > 0) {
            // There are listings that were overwritten, add a message to them that explains they were overwritten
            const desired = await this.getDesired(
              steamid,
              matches.filter((m): m is string => m !== null),
            );

            if (signal.aborted) {
              throw signal.error;
            }

            // Filter out null values and add the error message
            const set = desired
              .filter((d): d is DesiredListingInternal => d !== null)
              .map((d) => {
                if (d) {
                  d.message = 'Listing was overwritten';
                  d.updatedAt = now;
                  delete d.id;
                }

                return d;
              });

            if (set.length > 0) {
              // Overwrite the desired listings with the error message
              await this.redis.hset(
                this.getDesiredKey(steamid),
                ...set.flatMap((d) => [d.hash, JSON.stringify(d)]),
              );

              if (signal.aborted) {
                throw signal.error;
              }
            }
          }
        }
        if (hashes.length > 0) {
          // Update the desired listings with the new listing id
          const desired = await this.getDesired(steamid, hashes);

          if (signal.aborted) {
            throw signal.error;
          }

          const transaction = this.redis.multi();

          const archivedIds = hashes
            .filter((hash) => changed[hash].archived === true)
            .map((hash) => changed[hash].id);

          // Filter out null values and add the listing id
          const set = desired
            .filter((d): d is DesiredListingInternal => d !== null)
            .map((d) => {
              if (d) {
                d.id = changed[d.hash].id;
                d.archived = changed[d.hash].archived;
                d.updatedAt = now;
              }

              return d;
            });

          if (set.length > 0) {
            transaction
              // Overwrite the desired listings with the listing id
              .hset(
                this.getDesiredKey(steamid),
                ...set.flatMap((d) => [d.hash, JSON.stringify(d)]),
              );
          }

          if (archivedIds.length > 0) {
            transaction
              // Add archived listings to the delete queue to make sure an older listing is not active
              .sadd(this.getDeleteKey(steamid), ...archivedIds);
          }

          transaction
            // Save listings
            .hmset(
              this.getCurrentKey(steamid),
              hashes.flatMap((hash) => [
                changed[hash].id,
                JSON.stringify(changed[hash]),
              ]),
            )
            // Remove hashes from the create queue
            .zrem(this.getCreateKey(steamid), ...hashes);

          await transaction.exec();
        }
      },
    );
  }

  async handleDeletedListings(steamid: SteamID, ids: string[]): Promise<void> {
    // TODO: Remove listing ids from the desired listings?

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

        const transaction = this.redis.multi();

        if (desired.length > 0) {
          const updated: Record<string, string> = {};

          desired.forEach((d) => {
            if (!d.archived) {
              delete d.id;
              d.updatedAt = now;
              updated[d.hash] = JSON.stringify(d);
            }
          });

          // Update desired listings by removing the listing id for non-archived listings
          transaction.hset(this.getDesiredKey(steamid), updated);
        }

        await transaction
          // Remove current listings
          .del(this.getCurrentKey(steamid))
          // Clear delete queue
          .del(this.getDeleteKey(steamid))
          .exec();
      },
    );
  }

  async handleDeletedAllArchivedListings(steamid: SteamID) {
    await this.redlock.using(
      ['listings:' + steamid.getSteamID64()],
      5000,
      async () => {
        const now = Math.floor(Date.now() / 1000);

        const desired = await this.getAllDesired(steamid);

        const transaction = this.redis.multi();

        if (desired.length > 0) {
          const updated: Record<string, string> = {};

          desired.forEach((d) => {
            if (d.archived) {
              delete d.id;
              delete d.archived;
              d.updatedAt = now;
              updated[d.hash] = JSON.stringify(d);
            }
          });

          // Update desired listings by removing the listing id for non-archived listings
          transaction.hset(this.getDesiredKey(steamid), updated);
        }

        await transaction
          // Clear delete archived queue
          .del(this.getArchivedDeleteKey(steamid))
          .exec();
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
      archived: d.archived,
      message: d.message,
      listing: d.listing,
      priority: d.priority,
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
}

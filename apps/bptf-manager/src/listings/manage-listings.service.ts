import { OnEvent } from '@nestjs/event-emitter';
import {
  CurrentListingsCreateFailedEvent,
  CurrentListingsDeletedEvent,
  DesiredListingsAddedEvent,
  DesiredListingsRemovedEvent,
} from './interfaces/events.interface';
import { InjectRedis } from '@songkeys/nestjs-redis';
import { ChainableCommander, Redis } from 'ioredis';
import SteamID from 'steamid';
import {
  JobData as ManageJobData,
  JobName as ManageJobName,
  JobResult as ManageJobResult,
  JobType as ManageJobType,
} from './interfaces/manage-listings-queue.interface';
import { AgentsService } from '../agents/agents.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { DesiredListingsService } from './desired-listings.service';
import {
  DesiredListing,
  ExtendedDesiredListing,
  ListingError,
} from './interfaces/desired-listing.interface';
import { CurrentListingsService } from './current-listings.service';
import { Listing, Token } from '@tf2-automatic/bptf-manager-data';
import {
  BatchCreateListingResponse,
  BatchUpdateListingResponse,
} from './interfaces/bptf.interface';
import { ListingLimitsService } from './listing-limits.service';
import { InventoriesService } from '../inventories/inventories.service';
import { Logger } from '@nestjs/common';
import hash from 'object-hash';

const KEY_PREFIX = 'bptf-manager:data:';

export class ManageListingsService {
  private readonly logger = new Logger(ManageListingsService.name);

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly agentsService: AgentsService,
    private readonly desiredListingsService: DesiredListingsService,
    private readonly currentListingsService: CurrentListingsService,
    private readonly listingLimitsService: ListingLimitsService,
    private readonly inventoriesService: InventoriesService,
    @InjectQueue('manage-listings')
    private readonly queue: Queue<
      ManageJobData,
      ManageJobResult,
      ManageJobName
    >,
  ) {}

  @OnEvent('agents.registering')
  private async agentsRegistering(steamid: SteamID): Promise<void> {
    await this.createJob(steamid, ManageJobType.Plan);
  }

  @OnEvent('agents.unregistering')
  private async agentsUnregistering(steamid: SteamID): Promise<void> {
    await this.createJob(steamid, ManageJobType.DeleteAll);
  }

  @OnEvent('desired-listings.added')
  private async addedDesired(event: DesiredListingsAddedEvent) {
    const transaction = this.redis.multi();

    // Remove from delete queue
    transaction.srem(
      this.getDeleteKey(event.steamid),
      ...event.listings.map((d) => d.hash),
    );

    // Add to create queue
    this.chainableQueueDesired(transaction, event.steamid, event.listings);

    await transaction.exec();

    await Promise.all([
      this.createJob(event.steamid, ManageJobType.Update),
      this.createJob(event.steamid, ManageJobType.Create),
    ]);
  }

  @OnEvent('desired-listings.removed')
  private async removedDesired(event: DesiredListingsRemovedEvent) {
    const hashes = event.listings.map((d) => d.hash);

    const transaction = this.redis.multi();

    // Remove hashes from create queue
    transaction.zrem(this.getCreateKey(event.steamid), ...hashes);

    const ids = event.listings
      .filter((d) => d.id !== undefined)
      .map((d) => d.id!);

    if (ids.length > 0) {
      // Queue listings to be deleted
      transaction
        .sadd(this.getDeleteKey(event.steamid), ...ids)
        .sadd(this.getArchivedDeleteKey(event.steamid), ...ids);
    }

    await transaction.exec();

    await Promise.all([
      this.createJob(event.steamid, ManageJobType.DeleteArchived),
      this.createJob(event.steamid, ManageJobType.Delete),
    ]);
  }

  @OnEvent('desired-listings.created', {
    suppressErrors: false,
  })
  private async createdDesired(event: DesiredListingsAddedEvent) {
    const listings = await this.currentListingsService.getListingsByIds(
      event.steamid,
      event.listings.map((d) => d.id!),
    );

    const archivedIds = Object.values(listings)
      .filter((l) => l.archived === true)
      .map((l) => l.id);

    if (archivedIds.length > 0) {
      // Queue active listings to be deleted
      await this.redis
        .multi()
        .sadd(this.getDeleteKey(event.steamid), ...archivedIds)
        .sadd(
          this.currentListingsService.getCurrentShouldNotDeleteEntryKey(
            event.steamid,
          ),
          ...archivedIds,
        )
        .exec();

      await this.createJob(event.steamid, ManageJobType.Delete);
    }
  }

  @OnEvent('current-listings.deleted-all', {
    suppressErrors: false,
  })
  private async deletedAllCurrentListings(steamid: SteamID) {
    await this.redis
      .multi()
      // Clear active delete queue
      .del(this.getDeleteKey(steamid))
      // Clear archived delete queue
      .del(this.getArchivedDeleteKey(steamid))
      .exec();
  }

  @OnEvent('current-listings.deleted', {
    suppressErrors: false,
  })
  private async deletedCurrentListings(event: CurrentListingsDeletedEvent) {
    if (!event.isActive) {
      return;
    }

    await this.listingLimitsService.getLimits(event.steamid).then((limits) => {
      if (limits.cap > limits.used) {
        return this.createJob(event.steamid, ManageJobType.Create);
      }
    });
  }

  @OnEvent('current-listings.failed')
  private async failedCurrentListings(event: CurrentListingsCreateFailedEvent) {
    const found =
      Object.values(event.results).findIndex(
        (error) => error === ListingError.ItemDoesNotExist,
      ) !== -1;

    if (found) {
      // TODO: Schedule refresh for the time when the desired listing was created
      await this.inventoriesService.scheduleRefresh(event.steamid);
    }
  }

  async createJob(steamid: SteamID, type: ManageJobType): Promise<void> {
    if (type === ManageJobType.Create || type === ManageJobType.Update) {
      const agent = await this.agentsService.getAgent(steamid);
      if (!agent) {
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
        priority = 5;
        break;
      case ManageJobType.Update:
        priority = 4;
        break;
      case ManageJobType.DeleteAll:
        priority = 1;
        break;
    }

    await this.queue.add(
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

  @OnEvent('current-listings.refreshed', {
    suppressErrors: false,
  })
  private refreshedCurrentListings(steamid: SteamID) {
    return this.createJob(steamid, ManageJobType.Plan);
  }

  private chainableQueueDesired(
    chainable: ChainableCommander,
    steamid: SteamID,
    listings: ExtendedDesiredListing[],
  ): void {
    const create: DesiredListing[] = [];
    const update: DesiredListing[] = [];

    listings.forEach((d) => {
      if (d.id === undefined || d.force === true) {
        create.push(d);
      } else {
        update.push(d);
      }
    });

    if (create.length > 0) {
      this.chainableQueueDesiredSpecific(chainable, steamid, true, create);
    }

    if (update.length > 0) {
      this.chainableQueueDesiredSpecific(chainable, steamid, false, update);
    }
  }

  private chainableQueueDesiredSpecific(
    chainable: ChainableCommander,
    steamid: SteamID,
    create: boolean,
    listings: DesiredListing[],
  ): void {
    chainable.zadd(
      create ? this.getCreateKey(steamid) : this.getUpdateKey(steamid),
      ...listings.flatMap((d) => [
        d.priority ?? Number.MAX_SAFE_INTEGER,
        d.hash,
      ]),
    );
  }

  async getListingsToCreate(
    steamid: SteamID,
    count: number,
  ): Promise<string[]> {
    await this.listingLimitsService.waitForRefresh(steamid);

    const limits = await this.listingLimitsService.getLimits(steamid);

    // Prioritize updating listings over creating new ones

    const desired =
      await this.desiredListingsService.getAllDesiredInternal(steamid);

    // Get hashes of desired listings that have an id
    const desiredHashes = desired
      .filter((d) => d.id !== undefined)
      .map((d) => d.hash);

    const hashes = new Set<string>();

    const originalKey = this.getCreateKey(steamid);
    const copyKey = originalKey + ':copy';

    await this.redis.copy(this.getCreateKey(steamid), copyKey);

    if (desiredHashes.length > 0) {
      // Check if the desired listings are already in the queue
      const scores = await this.redis.zmscore(copyKey, ...desiredHashes);

      for (const [index, score] of scores.entries()) {
        if (hashes.size >= count) {
          // Don't need any more hashes
          break;
        }

        if (score !== null) {
          // Desired listing is already in the queue, add it to the set
          hashes.add(desiredHashes[index]);
        }
      }
    }

    // Remove hashes from the copied sorted set
    if (hashes.size > 0) {
      await this.redis.zrem(copyKey, ...Array.from(hashes.values()));
    }

    // Check if we have enough hashes
    if (count > hashes.size && limits.cap > limits.used) {
      // Get remaining hashes by priority
      const queue = await this.redis.zrange(
        copyKey,
        0,
        count - hashes.size - 1,
      );

      for (const hash of queue) {
        if (hashes.size >= count) {
          // Don't need any more hashes
          break;
        }

        hashes.add(hash);
      }
    }

    // Not needed but would save memory so why not
    await this.redis.del(copyKey);

    return Array.from(hashes.values());
  }

  async getListingsToUpdate(
    steamid: SteamID,
    count: number,
  ): Promise<string[]> {
    await this.listingLimitsService.waitForRefresh(steamid);

    return this.redis.zrange(this.getUpdateKey(steamid), 0, count - 1);
  }

  async createListings(
    token: Token,
    hashes: string[],
  ): Promise<BatchCreateListingResponse[]> {
    const desiredMap = await this.desiredListingsService.getDesiredByHashes(
      new SteamID(token.steamid64),
      hashes,
    );

    const desired = Object.values(desiredMap);

    let result: BatchCreateListingResponse[] = [];
    if (desired.length > 0) {
      result = await this.currentListingsService.createListings(token, desired);
    }

    await this.redis.zrem(
      this.getCreateKey(new SteamID(token.steamid64)),
      ...hashes,
    );

    return result;
  }

  async updateListings(
    token: Token,
    hashes: string[],
  ): Promise<BatchUpdateListingResponse> {
    const desiredMap = await this.desiredListingsService.getDesiredByHashes(
      new SteamID(token.steamid64),
      hashes,
    );

    const desired = Object.values(desiredMap);

    if (desired.length === 0) {
      return {
        updated: [],
        errors: [],
      };
    }

    const map = new Map<string, DesiredListing>();
    desired.forEach((d) => {
      // id should not be undefined but we check it anyway
      if (d.id !== undefined) {
        map.set(d.id, d);
      }
    });

    const result = await this.currentListingsService.updateListings(
      token,
      desired,
    );

    // List of hashes of listings that were successfully updated
    const updated: string[] = [];

    // Go through all updated listings and get the hash of the desired listing
    result.updated.forEach((_, i) => {
      const match = map.get(result.updated[i].id);
      if (match) {
        updated.push(match.hash);
      }
    });

    // Figure out what listings failed to be updated
    const failed: DesiredListing[] = [];
    desired.forEach((d) => {
      if (!updated.includes(d.hash)) {
        failed.push(d);
      }
    });

    const transaction = this.redis.multi();

    // Add failed listings to the create queue
    if (failed.length > 0) {
      this.chainableQueueDesiredSpecific(
        transaction,
        new SteamID(token.steamid64),
        true,
        failed,
      );
    }

    // Remove everything from the update queue
    transaction.zrem(
      this.getUpdateKey(new SteamID(token.steamid64)),
      ...hashes,
    );

    await transaction.exec();

    if (failed.length > 0) {
      await this.createJob(new SteamID(token.steamid64), ManageJobType.Create);
    }

    return result;
  }

  getListingsToDelete(steamid: SteamID, count: number): Promise<string[]> {
    return this.redis.srandmember(this.getDeleteKey(steamid), count);
  }

  async deleteListings(token: Token, ids: string[]) {
    const result = await this.currentListingsService.deleteListings(token, ids);

    await this.redis.srem(
      this.getDeleteKey(new SteamID(token.steamid64)),
      ...ids,
    );

    return result;
  }

  getArchivedListingToDelete(
    steamid: SteamID,
    count: number,
  ): Promise<string[]> {
    return this.redis.srandmember(this.getArchivedDeleteKey(steamid), count);
  }

  async deleteArchivedListings(token: Token, ids: string[]) {
    const result = await this.currentListingsService.deleteArchivedListings(
      token,
      ids,
    );

    await this.redis.srem(
      this.getArchivedDeleteKey(new SteamID(token.steamid64)),
      ...ids,
    );

    return result;
  }

  async planListings(steamid: SteamID): Promise<void> {
    const [current, desired] = await Promise.all([
      this.currentListingsService.getAllCurrent(steamid),
      this.desiredListingsService.getAllDesiredInternal(steamid),
    ]);

    const currentMap = new Map<string, Listing>();
    current.forEach((l) => currentMap.set(l.id, l));

    const update = new Map<string, DesiredListing>();
    const create = new Map<string, DesiredListing>();

    // Go through all desired and check if the listing is still active
    desired.forEach((d) => {
      if (d.id === undefined) {
        return;
      }

      const match = currentMap.get(d.id);
      if (!match) {
        // Listing does not exist or it no longer exists, add it to the create queue
        delete d.id;
      } else if (
        (d.listing.item?.quantity ?? 1) !== (match.item.quantity ?? 1)
      ) {
        create.set(d.hash, d);
      } else {
        const desiredHash = hash(
          {
            currencies: {
              keys: d.listing.currencies.keys ?? 0,
              metal: d.listing.currencies.metal ?? 0,
            },
            details: d.listing.details ?? '',
          },
          {
            respectType: false,
          },
        );

        const currentHash = hash(
          {
            currencies: {
              keys: match.currencies.keys ?? 0,
              metal: match.currencies.metal ?? 0,
            },
            details: match.details ?? '',
          },
          {
            respectType: false,
          },
        );

        if (desiredHash !== currentHash) {
          // Listing has changed, add it to the update queue
          update.set(d.hash, d);
        }
      }
    });

    const inventory = await this.inventoriesService.getInventory(steamid);

    // Queue listings to be created if they don't have a listing id
    desired.forEach((d) => {
      if (d.error === ListingError.InvalidItem) {
        // Don't retry invalid item errors because they will never be fixed
        return;
      } else if (d.error === undefined && d.id !== undefined) {
        // If there is no error and the listing already has an id then don't queue it to be created
        return;
      } else if (
        d.error === ListingError.ItemDoesNotExist &&
        inventory !== null
      ) {
        // Adding 1 second to the difference because the times might not be exact
        const difference =
          Math.abs(inventory.refresh - inventory.status.current_time) + 1;

        if (
          d.lastAttemptedAt &&
          d.lastAttemptedAt > inventory.status.last_update + difference
        ) {
          // Item was last attempted to be created after we last refreshed the inventory, or the inventory has not been refreshed since the last attempt
          return;
        }
      }

      if (update.has(d.hash)) {
        update.delete(d.hash);
      }
      create.set(d.hash, d);
    });

    const desiredWithId = new Map<string, DesiredListing>();
    desired.forEach((d) => {
      if (d.id !== undefined) {
        desiredWithId.set(d.id, d);
      }
    });

    const remove: string[] = [];

    // Queue listings to be deleted if they are not associated with a desired listing
    current.forEach((c) => {
      if (!desiredWithId.has(c.id)) {
        // Listing is not desired, add it to the delete queue
        remove.push(c.id);
      }
    });

    const transaction = this.redis.multi();

    if (create.size > 0) {
      this.chainableQueueDesiredSpecific(
        transaction,
        steamid,
        true,
        Array.from(create.values()),
      );
    }
    if (update.size > 0) {
      this.chainableQueueDesiredSpecific(
        transaction,
        steamid,
        false,
        Array.from(update.values()),
      );
    }

    if (remove.length > 0) {
      transaction.sadd(this.getDeleteKey(steamid), ...remove);
      transaction.sadd(this.getArchivedDeleteKey(steamid), ...remove);
    }

    this.desiredListingsService.chainableSaveDesired(
      transaction,
      steamid,
      desired,
    );

    // TODO: Delete listing ids that don't exist anymore

    // TODO: If listing cap is reached then delete listings that are of low priority

    await transaction.exec();

    this.logger.debug(
      'Queued ' +
        create.size +
        ' listing(s) to be created,' +
        update.size +
        ' listing(s) to be updated and ' +
        remove.length +
        ' listing(s) to be deleted',
    );

    const promises: Promise<unknown>[] = [];

    if (create.size > 0) {
      promises.push(this.createJob(steamid, ManageJobType.Create));
    }

    if (update.size > 0) {
      promises.push(this.createJob(steamid, ManageJobType.Update));
    }

    if (remove.length > 0) {
      promises.push(this.createJob(steamid, ManageJobType.Delete));
      promises.push(this.createJob(steamid, ManageJobType.DeleteArchived));
    }

    // Create jobs
    await Promise.all(promises);
  }

  async deleteAllListings(token: Token) {
    const result = await this.currentListingsService.deleteAllListings(token);

    return result;
  }

  private getCreateKey(steamid: SteamID): string {
    return `${KEY_PREFIX}listings:create:${steamid.getSteamID64()}`;
  }

  private getUpdateKey(steamid: SteamID): string {
    return `${KEY_PREFIX}listings:update:${steamid.getSteamID64()}`;
  }

  private getDeleteKey(steamid: SteamID): string {
    return `${KEY_PREFIX}listings:delete:${steamid.getSteamID64()}`;
  }

  private getArchivedDeleteKey(steamid: SteamID): string {
    return `${KEY_PREFIX}listings:delete:archived:${steamid.getSteamID64()}`;
  }
}

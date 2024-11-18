import { OnEvent } from '@nestjs/event-emitter';
import {
  CurrentListingsCreateFailedEvent,
  CurrentListingsDeletedEvent,
  DesiredListingsAddedEvent,
  DesiredListingsCreatedEvent,
  DesiredListingsRemovedEvent,
} from './interfaces/events.interface';
import { InjectRedis } from '@songkeys/nestjs-redis';
import { ChainableCommander, Redis } from 'ioredis';
import SteamID from 'steamid';
import {
  JobData,
  JobData as ManageJobData,
  JobName as ManageJobName,
  JobResult as ManageJobResult,
  JobType as ManageJobType,
} from './interfaces/manage-listings-queue.interface';
import { AgentsService } from '../agents/agents.service';
import { InjectQueue } from '@nestjs/bullmq';
import { JobsOptions, Queue } from 'bullmq';
import { DesiredListingsService } from './desired-listings.service';
import { CurrentListingsService } from './current-listings.service';
import { Listing, ListingError, Token } from '@tf2-automatic/bptf-manager-data';
import {
  BatchCreateListingResponse,
  BatchUpdateListingResponse,
} from './interfaces/bptf.interface';
import { ListingLimitsService } from './listing-limits.service';
import { InventoriesService } from '../inventories/inventories.service';
import { Logger } from '@nestjs/common';
import hash from 'object-hash';
import { DesiredListing as DesiredListingClass } from './classes/desired-listing.class';

enum ListingAction {
  Create,
  Update,
}

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

  /*
  We cannot do this because it results in a concurrency issue where the listings
  are refreshed while listings are being created, resulting in the listings
  being removed because they are not associated with a desired listing yet.

  @OnEvent('agents.registering')
  private async agentsRegistering(steamid: SteamID): Promise<void> {
    await this.createJob(steamid, ManageJobType.Plan);
  }
  */

  @OnEvent('agents.unregistering')
  private async agentsUnregistering(steamid: SteamID): Promise<void> {
    await this.createJob(steamid, ManageJobType.DeleteAll);

    // Clear any queues that the agent might have
    await this.redis
      .multi()
      .del(ManageListingsService.getCreateKey(steamid))
      .del(ManageListingsService.getUpdateKey(steamid))
      .del(ManageListingsService.getDeleteKey(steamid))
      .del(ManageListingsService.getArchivedDeleteKey(steamid))
      .exec();
  }

  @OnEvent('desired-listings.added')
  private async addedDesired(event: DesiredListingsAddedEvent) {
    const transaction = this.redis.multi();

    // Remove from delete queue
    transaction.srem(
      ManageListingsService.getDeleteKey(event.steamid),
      ...event.desired.map((d) => d.getHash()),
    );

    // Add to create queue
    const create: DesiredListingClass[] = [];
    const update: DesiredListingClass[] = [];

    event.desired.forEach((d) => {
      if (
        d.getError() === ListingError.InvalidItem ||
        d.getError() === ListingError.DuplicateListing ||
        d.getError() === ListingError.ItemDoesNotExist
      ) {
        // Don't queue listings with these errors just because the desired
        // listings were updated.
        return;
      }

      if (!d.getID() || d.isForced()) {
        create.push(d);
      } else {
        update.push(d);
      }
    });

    if (create.length > 0) {
      ManageListingsService.chainableQueueDesired(
        transaction,
        event.steamid,
        true,
        create,
      );
    }

    if (update.length > 0) {
      ManageListingsService.chainableQueueDesired(
        transaction,
        event.steamid,
        false,
        update,
      );
    }

    await transaction.exec();

    const promises: Promise<unknown>[] = [];

    if (create.length > 0) {
      promises.push(this.createJob(event.steamid, ManageJobType.Create));
    }

    if (update.length > 0) {
      promises.push(this.createJob(event.steamid, ManageJobType.Update));
    }

    await Promise.all(promises);
  }

  @OnEvent('desired-listings.removed')
  private async removedDesired(event: DesiredListingsRemovedEvent) {
    const hashes = event.desired.map((d) => d.getHash());

    const transaction = this.redis.multi();

    // Remove hashes from create queue
    transaction.zrem(
      ManageListingsService.getCreateKey(event.steamid),
      ...hashes,
    );

    const ids = event.desired
      .map((d) => d.getID())
      .filter((id): id is string => !!id);

    if (ids.length > 0) {
      // Queue listings to be deleted
      ManageListingsService.chainableQueueDelete(
        transaction,
        event.steamid,
        ids,
      );
    }

    await transaction.exec();

    if (ids.length > 0) {
      await Promise.all([
        this.createJob(event.steamid, ManageJobType.DeleteArchived),
        this.createJob(event.steamid, ManageJobType.Delete),
      ]);
    }
  }

  @OnEvent('desired-listings.created', {
    suppressErrors: false,
  })
  private async createdDesired(event: DesiredListingsAddedEvent) {
    const listings = await this.currentListingsService.getListingsByIds(
      event.steamid,
      event.desired.map((d) => d.getID()).filter((id): id is string => !!id),
    );

    const archivedIds = Array.from(listings.values())
      .filter((l) => l.archived === true)
      .map((l) => l.id);

    if (archivedIds.length > 0) {
      // Queue active listings to be deleted
      await this.redis
        .multi()
        .sadd(ManageListingsService.getDeleteKey(event.steamid), ...archivedIds)
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
      .del(ManageListingsService.getDeleteKey(steamid))
      // Clear archived delete queue
      .del(ManageListingsService.getArchivedDeleteKey(steamid))
      .exec();
  }

  @OnEvent('current-listings.deleted', {
    suppressErrors: false,
  })
  private async deletedCurrentListings(event: CurrentListingsDeletedEvent) {
    if (!event.isActive) {
      return;
    }

    const limits = await this.listingLimitsService.getLimits(event.steamid);
    if (limits.cap > limits.used) {
      return this.createJob(event.steamid, ManageJobType.Create);
    }
  }

  @OnEvent('current-listings.failed')
  private async failedCurrentListings(event: CurrentListingsCreateFailedEvent) {
    const found =
      Object.values(event.errors).findIndex(
        (error) => error === ListingError.ItemDoesNotExist,
      ) !== -1;

    if (found) {
      // TODO: Schedule refresh for the time when the desired listing was created
      await this.inventoriesService.scheduleRefresh(event.steamid);
    }
  }

  async createJob(steamid: SteamID, type: ManageJobType): Promise<void> {
    if (
      type === ManageJobType.Create ||
      type === ManageJobType.Update ||
      type === ManageJobType.Plan
    ) {
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

    const data: JobData = {
      steamid64: steamid.getSteamID64(),
    };

    const opts: JobsOptions = {
      jobId: type + ':' + steamid.getSteamID64(),
      priority,
    };

    await this.queue.add(type, data, opts);
  }

  @OnEvent('current-listings.refreshed', {
    suppressErrors: false,
  })
  private async refreshedCurrentListings(steamid: SteamID) {
    return this.createJob(steamid, ManageJobType.Plan);
  }

  private static chainableQueueDesired(
    chainable: ChainableCommander,
    steamid: SteamID,
    create: boolean,
    listings: DesiredListingClass[],
  ): void {
    chainable.zadd(
      create ? this.getCreateKey(steamid) : this.getUpdateKey(steamid),
      ...listings.flatMap((d) => [
        d.getPriority() ?? Number.MAX_SAFE_INTEGER,
        d.getHash(),
      ]),
    );
  }

  private static chainableQueueDelete(
    chainable: ChainableCommander,
    steamid: SteamID,
    hashes: string[],
  ): void {
    chainable.sadd(ManageListingsService.getDeleteKey(steamid), ...hashes);
    chainable.sadd(
      ManageListingsService.getArchivedDeleteKey(steamid),
      ...hashes,
    );
  }

  async getListingsToCreate(
    steamid: SteamID,
    count: number,
  ): Promise<string[]> {
    await this.listingLimitsService.waitForRefresh(steamid);

    const limits = await this.listingLimitsService.getLimits(steamid);

    // Prioritize updating listings over creating new ones

    const desired = await this.desiredListingsService.getAllDesired(steamid);

    // Get hashes of desired listings that have an id
    const desiredHashes = desired
      .filter((d) => d.getID())
      .map((d) => d.getHash());

    const hashes = new Set<string>();

    const originalKey = ManageListingsService.getCreateKey(steamid);
    const copyKey = originalKey + ':copy';

    await this.redis.copy(ManageListingsService.getCreateKey(steamid), copyKey);

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

    return this.redis.zrange(
      ManageListingsService.getUpdateKey(steamid),
      0,
      count - 1,
    );
  }

  async createListings(
    token: Token,
    hashes: string[],
  ): Promise<BatchCreateListingResponse[]> {
    const steamid = new SteamID(token.steamid64);

    const desiredMap = await this.desiredListingsService.getDesiredByHashes(
      steamid,
      hashes,
    );

    const desired = Array.from(desiredMap.values());

    let result: BatchCreateListingResponse[] = [];
    if (desired.length > 0) {
      result = await this.currentListingsService.createListings(token, desired);
    }

    await this.redis.zrem(
      ManageListingsService.getCreateKey(new SteamID(token.steamid64)),
      ...hashes,
    );

    return result;
  }

  @OnEvent('desired-listings.created', {
    suppressErrors: false,
  })
  @OnEvent('current-listings.updated', {
    suppressErrors: false,
  })
  async currentListingsUpdated(event: DesiredListingsCreatedEvent) {
    const desired = await this.desiredListingsService.getDesiredByHashes(
      event.steamid,
      Object.keys(event.listings),
    );

    // Loop through all desired listings and compare to the current listing

    const create: DesiredListingClass[] = [];
    const update: DesiredListingClass[] = [];
    const remove: string[] = [];

    Object.keys(event.listings).forEach((hash) => {
      const match = desired.get(hash);

      if (!match) {
        remove.push(event.listings[hash].id);
      } else if (!match.getID()) {
        create.push(match);
      } else if (match.getError() === ListingError.DuplicateListing) {
        const id = match.getID();
        if (id) {
          remove.push(id);
        }
      } else {
        const action = ManageListingsService.compareCurrentAndDesired(
          match,
          event.listings[hash],
        );

        if (action === ListingAction.Create) {
          create.push(match);
        } else if (action === ListingAction.Update) {
          update.push(match);
        }
      }
    });

    const transaction = this.redis.multi();

    if (create.length > 0) {
      // Add listings to create queue
      ManageListingsService.chainableQueueDesired(
        transaction,
        event.steamid,
        true,
        create,
      );
    }

    if (update.length > 0) {
      // Add listings to update queue
      ManageListingsService.chainableQueueDesired(
        transaction,
        event.steamid,
        false,
        update,
      );
    }

    if (remove.length > 0) {
      // Add listings to delete queues
      ManageListingsService.chainableQueueDelete(
        transaction,
        event.steamid,
        remove,
      );
    }

    await transaction.exec();

    this.logger.debug(
      'Queued ' +
        create.length +
        ' listing(s) to be created, ' +
        update.length +
        ' listing(s) to be updated and ' +
        remove.length +
        ' listing(s) to be deleted',
    );

    const promises: Promise<unknown>[] = [];

    if (create.length > 0) {
      promises.push(this.createJob(event.steamid, ManageJobType.Create));
    }

    if (update.length > 0) {
      promises.push(this.createJob(event.steamid, ManageJobType.Update));
    }

    if (remove.length > 0) {
      promises.push(this.createJob(event.steamid, ManageJobType.Delete));
      promises.push(
        this.createJob(event.steamid, ManageJobType.DeleteArchived),
      );
    }

    await Promise.all(promises);
  }

  async updateListings(
    token: Token,
    hashes: string[],
  ): Promise<BatchUpdateListingResponse> {
    const desiredMap = await this.desiredListingsService.getDesiredByHashes(
      new SteamID(token.steamid64),
      hashes,
    );

    const desired = Array.from(desiredMap.values());

    if (desired.length === 0) {
      return {
        updated: [],
        errors: [],
      };
    }

    const update = new Map<string, DesiredListingClass>();
    desired.forEach((d) => {
      // id should not be undefined but we check it anyway
      const id = d.getID();
      if (id) {
        update.set(id, d);
      }
    });

    const result = await this.currentListingsService.updateListings(
      token,
      Array.from(update.values()),
    );

    // List of hashes of listings that were successfully updated
    const updated: string[] = [];

    // Go through all updated listings and get the hash of the desired listing
    result.updated.forEach((value) => {
      const match = update.get(value.id);
      if (match) {
        updated.push(match.getHash());
      }
    });

    // Figure out what listings failed to be updated
    const failed: DesiredListingClass[] = [];
    desired.forEach((d) => {
      if (!updated.includes(d.getHash())) {
        failed.push(d);
      }
    });

    const transaction = this.redis.multi();

    // Add failed listings to the create queue
    if (failed.length > 0) {
      ManageListingsService.chainableQueueDesired(
        transaction,
        new SteamID(token.steamid64),
        true,
        failed,
      );
    }

    // Remove everything from the update queue
    transaction.zrem(
      ManageListingsService.getUpdateKey(new SteamID(token.steamid64)),
      ...hashes,
    );

    await transaction.exec();

    if (failed.length > 0) {
      await this.createJob(new SteamID(token.steamid64), ManageJobType.Create);
    }

    return result;
  }

  getListingsToDelete(steamid: SteamID, count: number): Promise<string[]> {
    return this.redis.srandmember(
      ManageListingsService.getDeleteKey(steamid),
      count,
    );
  }

  async deleteListings(token: Token, ids: string[]) {
    const result = await this.currentListingsService.deleteListings(token, ids);

    await this.redis.srem(
      ManageListingsService.getDeleteKey(new SteamID(token.steamid64)),
      ...ids,
    );

    return result;
  }

  getArchivedListingToDelete(
    steamid: SteamID,
    count: number,
  ): Promise<string[]> {
    return this.redis.srandmember(
      ManageListingsService.getArchivedDeleteKey(steamid),
      count,
    );
  }

  async deleteArchivedListings(token: Token, ids: string[]) {
    const result = await this.currentListingsService.deleteArchivedListings(
      token,
      ids,
    );

    await this.redis.srem(
      ManageListingsService.getArchivedDeleteKey(new SteamID(token.steamid64)),
      ...ids,
    );

    return result;
  }

  async planListings(steamid: SteamID): Promise<void> {
    const agent = await this.agentsService.getAgent(steamid);
    if (!agent) {
      return;
    }

    const [current, desired] = await Promise.all([
      this.currentListingsService.getAllCurrent(steamid),
      this.desiredListingsService.getAllDesired(steamid),
    ]);

    const currentMap = new Map<string, Listing>();
    current.forEach((l) => currentMap.set(l.id, l));

    const update = new Map<string, DesiredListingClass>();
    const create = new Map<string, DesiredListingClass>();

    // Listing id -> hashes
    const duplicates = new Map<string, DesiredListingClass[]>();

    const remove = new Set<string>();

    // Go through all desired and check if the listing is still active
    desired.forEach((d) => {
      const id = d.getID();
      if (!id) {
        return;
      }

      // Keep track of duplicates
      if (duplicates.has(id)) {
        duplicates.get(id)!.push(d);
      } else {
        duplicates.set(id, [d]);
      }

      if (d.getError() === ListingError.DuplicateListing) {
        const id = d.getID();
        if (id) {
          remove.add(id);
        }
      }

      const match = currentMap.get(id);

      if (!match) {
        // Listing no longer exists, remove the id
        d.setID(null);
      } else {
        const action = ManageListingsService.compareCurrentAndDesired(d, match);

        if (action === ListingAction.Create) {
          create.set(d.getHash(), d);
        } else if (action === ListingAction.Update) {
          update.set(d.getHash(), d);
        }
      }
    });

    for (const [id, dupes] of duplicates.entries()) {
      if (dupes.length === 1) {
        continue;
      }

      // Mark duplicate desired listings with an error
      dupes.forEach((d) => {
        d.setError(ListingError.DuplicateListing);
      });

      remove.add(id);
    }

    const inventory = await this.inventoriesService.getInventory(steamid);

    // Queue listings to be created if they don't have a listing id
    desired.forEach((d) => {
      if (d.getError() === ListingError.InvalidItem) {
        // Don't retry invalid item errors because they will never be fixed
        return;
      } else if (d.getError() === undefined && d.getID()) {
        // If there is no error and the listing already has an id then don't queue it to be created
        return;
      } else if (d.getError() === ListingError.DuplicateListing) {
        // Don't retry duplicate listing errors because they will never be fixed
        return;
      } else if (
        d.getError() === ListingError.ItemDoesNotExist &&
        inventory !== null
      ) {
        // Adding 1 second to the difference because the times might not be exact
        const difference =
          Math.abs(inventory.refresh - inventory.status.current_time) + 1;

        const lastAttemptedAt = d.getLastAttemptedAt();
        if (
          lastAttemptedAt &&
          lastAttemptedAt > inventory.status.last_update + difference
        ) {
          // Item was last attempted to be created after we last refreshed the inventory, or the inventory has not been refreshed since the last attempt
          return;
        }
      }

      if (update.has(d.getHash())) {
        update.delete(d.getHash());
      }
      create.set(d.getHash(), d);
    });

    const desiredWithId = new Map<string, DesiredListingClass>();
    desired.forEach((d) => {
      const id = d.getID();
      if (id) {
        desiredWithId.set(id, d);
      }
    });

    // Queue listings to be deleted if they are not associated with a desired listing
    current.forEach((c) => {
      if (!desiredWithId.has(c.id)) {
        // Listing is not desired, add it to the delete queue
        remove.add(c.id);
      }
    });

    const transaction = this.redis.multi();

    if (create.size > 0) {
      // Add listings to create queue
      ManageListingsService.chainableQueueDesired(
        transaction,
        steamid,
        true,
        Array.from(create.values()),
      );
    }
    if (update.size > 0) {
      // Add listings to update queue
      ManageListingsService.chainableQueueDesired(
        transaction,
        steamid,
        false,
        Array.from(update.values()),
      );
    }

    if (remove.size > 0) {
      // Add listings to delete queues
      ManageListingsService.chainableQueueDelete(
        transaction,
        steamid,
        Array.from(remove.values()),
      );
    }

    if (desired.length > 0) {
      DesiredListingsService.chainableSaveDesired(
        transaction,
        steamid,
        desired,
      );
    }

    await transaction.exec();

    this.logger.debug(
      'Queued ' +
        create.size +
        ' listing(s) to be created, ' +
        update.size +
        ' listing(s) to be updated and ' +
        remove.size +
        ' listing(s) to be deleted',
    );

    const promises: Promise<unknown>[] = [];

    if (create.size > 0) {
      promises.push(this.createJob(steamid, ManageJobType.Create));
    }

    if (update.size > 0) {
      promises.push(this.createJob(steamid, ManageJobType.Update));
    }

    if (remove.size > 0) {
      promises.push(this.createJob(steamid, ManageJobType.Delete));
      promises.push(this.createJob(steamid, ManageJobType.DeleteArchived));
    }

    // Create jobs
    await Promise.all(promises);
  }

  private static compareCurrentAndDesired(
    desired: DesiredListingClass,
    current: Listing,
  ): ListingAction.Create | ListingAction.Update | null {
    const listing = desired.getListing();

    if ((listing.item?.quantity ?? 1) !== (current.item?.quantity ?? 1)) {
      return ListingAction.Create;
    } else {
      const desiredHash = hash(
        {
          currencies: {
            keys: listing.currencies.keys ?? 0,
            metal: listing.currencies.metal ?? 0,
          },
          details: listing.details ?? '',
        },
        {
          respectType: false,
        },
      );

      const currentHash = hash(
        {
          currencies: {
            keys: current.currencies.keys ?? 0,
            metal: current.currencies.metal ?? 0,
          },
          details: current.details ?? '',
        },
        {
          respectType: false,
        },
      );

      if (desiredHash !== currentHash) {
        // Listing has changed, add it to the update queue
        return ListingAction.Update;
      }
    }

    return null;
  }

  async deleteAllListings(token: Token) {
    const result = await this.currentListingsService.deleteAllListings(token);

    return result;
  }

  private static getCreateKey(steamid: SteamID): string {
    return `listings:create:${steamid.getSteamID64()}`;
  }

  private static getUpdateKey(steamid: SteamID): string {
    return `listings:update:${steamid.getSteamID64()}`;
  }

  private static getDeleteKey(steamid: SteamID): string {
    return `listings:delete:${steamid.getSteamID64()}`;
  }

  private static getArchivedDeleteKey(steamid: SteamID): string {
    return `listings:delete:archived:${steamid.getSteamID64()}`;
  }
}

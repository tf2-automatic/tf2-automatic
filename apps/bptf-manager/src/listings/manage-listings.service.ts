import { OnEvent } from '@nestjs/event-emitter';
import {
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
import { DesiredListing } from './interfaces/desired-listing.interface';
import { CurrentListingsService } from './current-listings.service';
import { Token } from '@tf2-automatic/bptf-manager-data';
import { BatchCreateListingResponse } from './interfaces/bptf-response.interface';

const KEY_PREFIX = 'bptf-manager:data:';

export class ManageListingsService {
  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly agentsService: AgentsService,
    private readonly desiredListingsService: DesiredListingsService,
    private readonly currentListingsService: CurrentListingsService,
    @InjectQueue('manage-listings')
    private readonly queue: Queue<
      ManageJobData,
      ManageJobResult,
      ManageJobName
    >,
  ) {}

  @OnEvent('agents.registering')
  private async agentsRegistering(steamid: SteamID): Promise<void> {
    // TODO: Queue a job to compare current listings to desired listings and create/delete listings based on that

    const desired =
      await this.desiredListingsService.getAllDesiredInternal(steamid);

    if (desired.length > 0) {
      const transaction = this.redis.multi();
      this.chainableQueueDesired(transaction, steamid, desired);
      await transaction.exec();

      await this.createJob(steamid, ManageJobType.Create);
    }
  }

  @OnEvent('agents.unregistering')
  private async agentsUnregistering(steamid: SteamID): Promise<void> {
    await this.createJob(steamid, ManageJobType.DeleteAll);
  }

  @OnEvent('desired-listings.added')
  private async addedDesired(event: DesiredListingsAddedEvent) {
    const queue = event.listings.filter((listing) => listing.id === undefined);

    const transaction = this.redis.multi();

    // Remove from delete queue
    transaction.srem(
      this.getDeleteKey(event.steamid),
      ...event.listings.map((d) => d.hash),
    );

    if (queue.length > 0) {
      // Add to create queue
      this.chainableQueueDesired(transaction, event.steamid, queue);
    }

    await transaction.exec();

    if (queue.length > 0) {
      await this.createJob(event.steamid, ManageJobType.Create);
    }
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
      await this.redis.sadd(this.getDeleteKey(event.steamid), ...archivedIds);

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
      // Clear create queue
      .del(this.getCreateKey(steamid))
      .exec();
  }

  async createJob(steamid: SteamID, type: ManageJobType): Promise<void> {
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

  private chainableQueueDesired(
    chainable: ChainableCommander,
    steamid: SteamID,
    listings: DesiredListing[],
  ): void {
    chainable.zadd(
      this.getCreateKey(steamid),
      ...listings.flatMap((d) => [
        d.priority ?? Number.MAX_SAFE_INTEGER,
        d.hash,
      ]),
    );
  }

  getListingsToCreate(steamid: SteamID, count: number): Promise<string[]> {
    return this.redis.zrange(this.getCreateKey(steamid), 0, count - 1);
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
      ...desired.map((d) => d.hash),
    );

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

  async deleteAllListings(token: Token) {
    const result = await this.currentListingsService.deleteAllListings(token);

    return result;
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
}

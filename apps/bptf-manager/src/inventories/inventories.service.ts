import { HttpService } from '@nestjs/axios';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import SteamID from 'steamid';
import { getJobs } from '@tf2-automatic/queue';
import {
  InventoryStatus,
  RefreshInventoryDto,
} from '@tf2-automatic/bptf-manager-data';
import { firstValueFrom } from 'rxjs';
import {
  EnqueueJobResult,
  InventoriesJobData,
  InventoriesJobResult,
  EnqueueJobData,
} from './interfaces/queue.interface';
import { Redis } from 'ioredis';
import { RedisService } from '@liaoliaots/nestjs-redis';
import { Inventory } from './interfaces/inventory.interface';
import { LockDuration, Locker } from '@tf2-automatic/locking';
import { pack, unpack } from 'msgpackr';

@Injectable()
export class InventoriesService {
  private readonly logger = new Logger(InventoriesService.name);

  private readonly redis: Redis = this.redisService.getOrThrow();
  private readonly locker: Locker = new Locker(this.redis);

  constructor(
    @InjectQueue('inventories')
    private readonly inventoriesQueue: Queue<
      InventoriesJobData,
      InventoriesJobResult
    >,
    @InjectQueue('enqueueInventories')
    private readonly enqueueInventoriesQueue: Queue<
      EnqueueJobData,
      EnqueueJobResult
    >,
    private readonly httpService: HttpService,
    private readonly redisService: RedisService,
  ) {}

  async scheduleRefresh(
    steamid: SteamID,
    body?: RefreshInventoryDto,
  ): Promise<void> {
    const steamid64 = steamid.getSteamID64();

    const time = body?.time ?? Math.floor(Date.now() / 1000);

    await this.locker.using(
      [`inventories:${steamid64}`],
      LockDuration.SHORT,
      async (signal) => {
        const [refreshPoint, inventory] = await Promise.all([
          this.getRefreshPoint(steamid),
          this.getInventory(steamid),
        ]);

        if (inventory && inventory.status.timestamp >= time) {
          // The inventory snapshot is already newer than the requested time
          return;
        }

        if (signal.aborted) {
          throw signal.error;
        }

        // Set refresh point before the job is added so the enqueue processor sees it
        await this.setRefreshPoint(steamid, Math.max(refreshPoint ?? 0, time));

        // Start a chain if there is none, or if it died
        if (
          refreshPoint === null ||
          (await this.getJobs(steamid)).length === 0
        ) {
          await this.enqueueInventoriesQueue.add(
            steamid64,
            {
              steamid64,
            },
            {
              jobId: 'enqueue_' + steamid64,
            },
          );
        }
      },
    );
  }

  async enqueueRefresh(
    steamid: SteamID,
    status: InventoryStatus,
    attempts = 0,
    attemptsSinceLastRefresh = 0,
  ): Promise<void> {
    const steamid64 = steamid.getSteamID64();

    // The amount of seconds we need to wait before refreshing
    const wait = status.next_update - status.current_time;

    // If the wait is negative, we need to refresh immediately
    let delay = wait < 0 ? 0 : wait;

    // If the delay is 0 and it is not our first attempt, then we need to wait 10 seconds
    if (delay === 0 && attempts > 0) {
      delay = 10;
    }

    await this.inventoriesQueue.add(
      steamid64,
      {
        steamid64,
        attempts,
        attemptsSinceLastRefresh,
        refreshed: status.timestamp,
      },
      {
        delay: delay * 1000,
        jobId: steamid64 + '_' + attempts,
      },
    );

    this.logger.debug('Enqueued inventory refresh in ' + delay + ' second(s)');
  }

  async dequeueRefresh(steamid: SteamID): Promise<void> {
    await this.locker.using(
      [`inventories:${steamid.getSteamID64()}`],
      LockDuration.SHORT,
      () => this.deleteRefreshPoint(steamid),
    );

    // Active jobs cannot be removed, they stop on their own when the refresh point is missing
    const jobs = await this.getJobs(steamid);

    await Promise.allSettled(jobs.map((job) => job.remove()));
  }

  async continueRefresh(
    steamid: SteamID,
    status: InventoryStatus,
    inventory: Inventory | null,
    data: InventoriesJobData,
  ): Promise<InventoriesJobResult> {
    const refreshed = status.timestamp > data.refreshed;

    // Decide under the lock so a new refresh point can't be lost
    return this.locker.using(
      [`inventories:${steamid.getSteamID64()}`],
      LockDuration.SHORT,
      async () => {
        const refreshPoint = await this.getRefreshPoint(steamid);

        if (refreshPoint === null) {
          // The refresh was cancelled
          return { done: true, cancelled: true, status };
        }

        if (
          refreshed &&
          inventory !== null &&
          inventory.refresh >= refreshPoint
        ) {
          await this.deleteRefreshPoint(steamid);
          return { done: true, status: inventory.status };
        }

        await this.enqueueRefresh(
          steamid,
          status,
          data.attempts + 1,
          refreshed ? 0 : data.attemptsSinceLastRefresh + 1,
        );

        return { done: false, status };
      },
    );
  }

  async getJobs(
    steamid: SteamID,
  ): Promise<Job<InventoriesJobData | EnqueueJobData>[]> {
    const filter = (job: Job) => job.data.steamid64 === steamid.getSteamID64();

    const [inventories, enqueue] = await Promise.all([
      getJobs(this.inventoriesQueue, filter),
      getJobs(this.enqueueInventoriesQueue, filter),
    ]);

    return [...inventories, ...enqueue];
  }

  private getInventoryKey(steamid64: string) {
    return 'inventories:' + steamid64;
  }

  private getInventoryRefreshPointKey(steamid64: string) {
    return 'inventories:refresh:' + steamid64;
  }

  async getInventoryStatus(
    steamid: SteamID,
    token: string,
  ): Promise<InventoryStatus> {
    const status = await firstValueFrom(
      this.httpService.get<InventoryStatus>(
        `https://api.backpack.tf/api/inventory/${steamid.getSteamID64()}/status`,
        {
          headers: {
            'X-Auth-Token': token,
          },
        },
      ),
    ).then((response) => {
      return response.data;
    });

    return status;
  }

  async refreshInventory(
    steamid: SteamID,
    token: string,
  ): Promise<InventoryStatus> {
    const now = new Date();

    const status = await firstValueFrom(
      this.httpService.post<InventoryStatus>(
        `https://api.backpack.tf/api/inventory/${steamid.getSteamID64()}/refresh`,
        {},
        {
          headers: {
            'X-Auth-Token': token,
          },
        },
      ),
    ).then((response) => {
      return response.data;
    });

    await this.saveInventory(steamid, status, now);

    return status;
  }

  private async saveInventory(
    steamid: SteamID,
    status: InventoryStatus,
    date: Date,
  ): Promise<void> {
    const key = this.getInventoryKey(steamid.getSteamID64());

    const data: Inventory = {
      status,
      refresh: Math.floor(date.getTime() / 1000),
    };

    await this.redis
      .pipeline()
      .set(key, pack(data))
      .expire(key, 24 * 60 * 60)
      .exec();
  }

  async getInventory(steamid: SteamID): Promise<Inventory | null> {
    const data = await this.redis.getBuffer(
      this.getInventoryKey(steamid.getSteamID64()),
    );

    if (!data) {
      return null;
    }

    return unpack(data);
  }

  async setRefreshPoint(steamid: SteamID, time: number): Promise<void> {
    await this.redis.set(
      this.getInventoryRefreshPointKey(steamid.getSteamID64()),
      time,
    );
  }

  async getRefreshPoint(steamid: SteamID): Promise<number | null> {
    const data = await this.redis.get(
      this.getInventoryRefreshPointKey(steamid.getSteamID64()),
    );

    if (!data) {
      return null;
    }

    return parseInt(data);
  }

  async deleteRefreshPoint(steamid: SteamID): Promise<void> {
    await this.redis.del(
      this.getInventoryRefreshPointKey(steamid.getSteamID64()),
    );
  }
}

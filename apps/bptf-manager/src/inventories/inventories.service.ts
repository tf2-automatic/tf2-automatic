import { HttpService } from '@nestjs/axios';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import SteamID from 'steamid';
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
import { InjectRedis } from '@songkeys/nestjs-redis';
import { Inventory } from './interfaces/inventory.interface';
import Redlock from 'redlock';
import { getLockConfig } from '@tf2-automatic/config';

const KEY_PREFIX = 'bptf-manager:data:';

@Injectable()
export class InventoriesService {
  private readonly logger = new Logger(InventoriesService.name);

  private readonly redlock: Redlock;

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
    @InjectRedis() private readonly redis: Redis,
  ) {
    this.redlock = new Redlock([this.redis], getLockConfig());
  }

  async scheduleRefresh(
    steamid: SteamID,
    body?: RefreshInventoryDto,
  ): Promise<void> {
    const steamid64 = steamid.getSteamID64();

    const time = body?.time ?? Math.floor(Date.now() / 1000);

    await this.redlock.using(
      [`bptf-manager:inventories:${steamid64}`],
      1000,
      async (signal) => {
        const refreshPoint = await this.getRefreshPoint(steamid);

        if (refreshPoint && refreshPoint > time) {
          // The time requested is before the current refresh point, skip it
          return;
        }

        if (signal.aborted) {
          throw signal.error;
        }

        // Check if job already exists
        const jobs = await this.getJobs(steamid);
        if (jobs.length === 0) {
          // Add job to the queue
          await this.enqueueInventoriesQueue.add(
            steamid64,
            {
              steamid64,
            },
            {
              jobId: 'enqueue:' + steamid64,
            },
          );
        }

        // Set refresh point after the job has been added to ensure no deadlocks
        await this.setRefreshPoint(steamid, time);
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
        jobId: steamid64 + ':' + attempts,
      },
    );

    this.logger.log(
      'Enqueued refresh for ' + steamid64 + ' in ' + delay + ' second(s)',
    );
  }

  async dequeueRefresh(steamid: SteamID): Promise<void> {
    await this.deleteRefreshPoint(steamid);

    const jobs = await this.getJobs(steamid);

    await Promise.allSettled(jobs.map((job) => job.remove()));
  }

  async getJobs(steamid: SteamID): Promise<Job<InventoriesJobData>[]> {
    const match: Job[] = [];

    let start = 0;
    let moreJobs = true;

    while (moreJobs) {
      const end = start + 100;
      const jobs = await this.inventoriesQueue.getJobs(
        undefined,
        start,
        end,
        true,
      );

      if (jobs.length !== 1 + end - start) {
        moreJobs = false;
      }

      jobs.forEach((job) => {
        if (job.data.steamid64 === steamid.getSteamID64()) {
          match.push(job);
        }
      });

      start = end + 1;
    }

    return match;
  }

  private getInventoryKey(steamid64: string) {
    return KEY_PREFIX + 'inventories:' + steamid64;
  }

  private getInventoryRefreshPointKey(steamid64: string) {
    return KEY_PREFIX + 'inventories:refresh:' + steamid64;
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
      .set(key, JSON.stringify(data))
      .expire(key, 24 * 60 * 60)
      .exec();
  }

  async getInventory(steamid: SteamID): Promise<Inventory | null> {
    const data = await this.redis.get(
      this.getInventoryKey(steamid.getSteamID64()),
    );

    if (!data) {
      return null;
    }

    return JSON.parse(data);
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

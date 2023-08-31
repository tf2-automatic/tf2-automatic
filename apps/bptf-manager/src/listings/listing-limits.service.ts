import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import SteamID from 'steamid';
import { ChainableCommander, Redis } from 'ioredis';
import { InjectRedis } from '@songkeys/nestjs-redis';
import { InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { OnEvent } from '@nestjs/event-emitter';
import { ListingLimits } from './interfaces/limits.interface';
import { setTimeout } from 'timers/promises';

const KEY_PREFIX = 'bptf-manager:data:';

@Injectable()
export class ListingLimitsService {
  private readonly logger = new Logger(ListingLimitsService.name);

  constructor(
    @InjectQueue('listing-limits')
    private readonly listingLimitsQueue: Queue,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async getLimits(steamid: SteamID): Promise<ListingLimits> {
    const current = await this.redis.hgetall(this.getLimitsKey(steamid));

    if (
      current.cap === undefined ||
      current.used === undefined ||
      current.promoted === undefined ||
      current.updatedAt === undefined
    ) {
      throw new NotFoundException('Listing limits not found');
    }

    return {
      cap: parseInt(current.cap, 10),
      used: parseInt(current.used, 10),
      promoted: parseInt(current.promoted, 10),
      updatedAt: parseInt(current.updatedAt, 10),
    };
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

  async waitForRefresh(steamid: SteamID): Promise<void> {
    let job: Job | undefined;

    let logged = false;

    do {
      const start = Date.now();
      job = await this.listingLimitsQueue.getJob(
        'refresh:' + steamid.getSteamID64(),
      );

      if (job === undefined || job.finishedOn !== undefined) {
        if (logged) {
          this.logger.debug(
            'Refresh job for ' + steamid.getSteamID64() + ' finished',
          );
        }

        // Job does not exist, stop
        break;
      }

      if (!logged) {
        this.logger.debug(
          'Waiting for refresh job for ' + steamid.getSteamID64() + '...',
        );
        logged = true;
      }

      // Wait 100 ms between checks
      await setTimeout(100 - Date.now() + start);
    } while (job !== undefined);
  }

  chainableClearUsed(chainable: ChainableCommander, steamid: SteamID) {
    this.chainableSaveLimits(chainable, steamid, {
      used: 0,
    });
  }

  async saveLimits(
    steamid: SteamID,
    limits: Partial<Omit<ListingLimits, 'updatedAt'>>,
  ): Promise<void> {
    const transaction = this.redis.multi();
    this.chainableSaveLimits(transaction, steamid, limits);
    await transaction.exec();
  }

  chainableSaveLimits(
    chainable: ChainableCommander,
    steamid: SteamID,
    limits: Partial<Omit<ListingLimits, 'updatedAt'>>,
  ) {
    const save: Partial<ListingLimits> = Object.assign(limits, {
      updatedAt: Math.floor(Date.now() / 1000),
    });

    chainable.hmset(this.getLimitsKey(steamid), save);
  }

  chainableIncrementUsed(
    chainable: ChainableCommander,
    steamid: SteamID,
    amount: number,
  ) {
    if (amount === 0) {
      return;
    }

    chainable.hincrby(this.getLimitsKey(steamid), 'used', amount);
  }

  private getLimitsKey(steamid: SteamID): string {
    return `${KEY_PREFIX}listings:limits:${steamid.getSteamID64()}`;
  }
}

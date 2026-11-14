import { Injectable, NotFoundException } from '@nestjs/common';
import SteamID from 'steamid';
import { ChainableCommander, Redis } from 'ioredis';
import { RedisService } from '@liaoliaots/nestjs-redis';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { OnEvent } from '@nestjs/event-emitter';
import { ListingLimits } from '@tf2-automatic/bptf-manager-data';

@Injectable()
export class ListingLimitsService {
  private readonly redis: Redis = this.redisService.getOrThrow();

  constructor(
    @InjectQueue('listing-limits')
    private readonly listingLimitsQueue: Queue,
    private readonly redisService: RedisService,
  ) {}

  async getLimits(steamid: SteamID): Promise<ListingLimits> {
    const current = await this.redis.hgetall(this.getLimitsKey(steamid));

    if (
      current.cap === undefined ||
      current.used === undefined ||
      current.promoted === undefined ||
      current.updatedAt === undefined
    ) {
      // First registration or lost limits, fetch them for the next attempt
      await this.refreshLimits(steamid);
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
        jobId: 'refresh_' + steamid.getSteamID64(),
      },
    );
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
    return `listings:limits:${steamid.getSteamID64()}`;
  }
}

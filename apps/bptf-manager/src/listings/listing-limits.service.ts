import { Injectable, NotFoundException } from '@nestjs/common';
import SteamID from 'steamid';
import { Redis } from 'ioredis';
import { InjectRedis } from '@songkeys/nestjs-redis';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { OnEvent } from '@nestjs/event-emitter';
import { ListingLimits } from './interfaces/limits.interface';

const KEY_PREFIX = 'bptf-manager:data:';

@Injectable()
export class ListingLimitsService {
  constructor(
    @InjectQueue('listing-limits')
    private readonly listingLimitsQueue: Queue,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async getLimits(steamid: SteamID): Promise<ListingLimits> {
    const current = await this.redis.hgetall(this.getLimitsKey(steamid));

    if (
      current.listings === undefined ||
      current.promoted === undefined ||
      current.updatedAt === undefined
    ) {
      throw new NotFoundException('Listing limits not found');
    }

    return {
      listings: parseInt(current.listings, 10),
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

  async saveLimits(
    steamid: SteamID,
    limits: Partial<Omit<ListingLimits, 'updatedAt'>>,
  ): Promise<void> {
    const save: Partial<ListingLimits> = Object.assign(limits, {
      updatedAt: Math.floor(Date.now() / 1000),
    });

    await this.redis.hmset(this.getLimitsKey(steamid), save);
  }

  private getLimitsKey(steamid: SteamID): string {
    return `${KEY_PREFIX}listings:limits:${steamid.getSteamID64()}`;
  }
}

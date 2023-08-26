import { Injectable, NotFoundException } from '@nestjs/common';
import SteamID from 'steamid';
import { Redis } from 'ioredis';
import { InjectRedis } from '@songkeys/nestjs-redis';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ListingLimitsResponse } from './interfaces/bptf-response.interface';
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

  private getLimitsKey(steamid: SteamID): string {
    return `${KEY_PREFIX}listings:limits:${steamid.getSteamID64()}`;
  }
}

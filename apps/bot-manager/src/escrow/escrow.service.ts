import { InjectRedis } from '@liaoliaots/nestjs-redis';
import { HttpService } from '@nestjs/axios';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import {
  ESCROW_BASE_URL,
  ESCROW_GET_DURATION,
  GetEscrowResponse,
} from '@tf2-automatic/bot-data';
import { Bot, EscrowResponse } from '@tf2-automatic/bot-manager-data';
import { Redis } from 'ioredis';
import { firstValueFrom } from 'rxjs';
import SteamID from 'steamid';
import { HeartbeatsService } from '../heartbeats/heartbeats.service';
import { EscrowWithTimestamp } from './interfaces/escrow.interface';

const ESCROW_EXPIRE_TIME = 24 * 60 * 60;

@Injectable()
export class EscrowService {
  constructor(
    @InjectRedis()
    private readonly redis: Redis,
    private readonly httpService: HttpService,
    private readonly heartbeatsService: HeartbeatsService
  ) {}

  async getEscrow(steamid: SteamID): Promise<EscrowResponse> {
    const cached = await this.getEscrowFromCache(steamid);
    if (cached !== null) {
      return {
        cached: true,
        timestamp: cached.timestamp,
        escrowDays: cached.escrowDays,
      };
    }

    const bots = await this.heartbeatsService.getBots();
    if (bots.length === 0) {
      throw new ServiceUnavailableException('No bots available');
    }

    const bot = bots[Math.floor(Math.random() * bots.length)];

    return this.getEscrowFromBot(bot, steamid).then((result) => ({
      cached: false,
      timestamp: result.timestamp,
      escrowDays: result.escrowDays,
    }));
  }

  async getEscrowFromBot(
    bot: Bot,
    steamid: SteamID
  ): Promise<EscrowWithTimestamp> {
    const now = Math.floor(Date.now() / 1000);

    const response = await firstValueFrom(
      this.httpService.get<GetEscrowResponse>(
        `http://${bot.ip}:${bot.port}${ESCROW_BASE_URL}${ESCROW_GET_DURATION}`.replace(
          ':steamid',
          steamid.getSteamID64()
        )
      )
    );

    const object = {
      timestamp: now,
      escrowDays: response.data.escrowDays,
    };

    const key = `escrow:${steamid.getSteamID64()}`;

    await this.redis
      .pipeline()
      .hset(key, object)
      .expire(key, ESCROW_EXPIRE_TIME)
      .exec();

    return object;
  }

  async getEscrowFromCache(
    steamid: SteamID
  ): Promise<EscrowWithTimestamp | null> {
    const key = `escrow:${steamid.getSteamID64()}`;
    const object = await this.redis.hgetall(key);

    if (Object.keys(object).length === 0) {
      return null;
    }

    const timestamp = parseInt(object.timestamp, 10);
    const escrowDays = parseInt(object.escrowDays, 10);

    return {
      timestamp,
      escrowDays,
    };
  }

  async deleteEscrow(steamid: SteamID): Promise<void> {
    await this.redis.del(`escrow:${steamid.getSteamID64()}`);
  }
}

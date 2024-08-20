import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@songkeys/nestjs-redis';
import { Notification, Token } from '@tf2-automatic/bptf-manager-data';
import { Redis } from 'ioredis';
import { firstValueFrom } from 'rxjs';
import { GetNotificationsResponse } from './interfaces/notifications';
import SteamID from 'steamid';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { JobData } from './interfaces/queue';
import Redlock from 'redlock';
import { getLockConfig } from '@tf2-automatic/config';

const KEY_PREFIX = 'bptf-manager:data:';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  private readonly redlock: Redlock;

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly httpService: HttpService,
    @InjectQueue('notifications')
    private readonly notificationsQueue: Queue<JobData>,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.redlock = new Redlock([redis], getLockConfig());
  }

  async getNotifications(steamid: SteamID): Promise<Notification[]> {
    const values = await this.redis.hvals(this.getKey(steamid));

    return values.map((raw) => {
      return JSON.parse(raw) as Notification;
    });
  }

  refreshNotifications(steamid: SteamID): Promise<void> {
    return this.createJob(steamid);
  }

  async getNotificationsAndContinue(
    token: Token,
    time: number = Date.now(),
    skip?: number,
    limit?: number,
  ) {
    const response = await this.fetchNotifications(token, skip, limit);

    this.logger.debug(
      'Got notifications response for ' +
        token.steamid64 +
        ': skip: ' +
        response.cursor.skip +
        ', limit: ' +
        response.cursor.limit +
        ', total: ' +
        response.cursor.total +
        ', results: ' +
        response.results.length,
    );

    const steamid = new SteamID(token.steamid64);

    const resource =
      KEY_PREFIX + `notifications:refresh:${steamid.getSteamID64()}`;

    await this.redlock.using([resource], 5000, async (signal) => {
      const key = this.getKey(steamid);
      const tempKey = key + ':' + time;

      if (response.results.length > 0) {
        await this.saveTempNotifications(steamid, response.results);

        await this.redis
          .multi()
          .hmset(tempKey, ...this.flatMap(response.results))
          .expire(tempKey, 5 * 60)
          .exec();
      }

      if (signal.aborted) {
        throw signal.error;
      }

      if (
        response.cursor.skip + response.cursor.limit >=
        response.cursor.total
      ) {
        const exists = await this.redis.exists(tempKey);

        const transaction = this.redis.multi();

        if (exists) {
          transaction
            .copy(tempKey, this.getKey(steamid), 'REPLACE')
            .persist(key);
        } else {
          transaction.del(key);
        }

        await transaction.exec();

        await this.eventEmitter.emitAsync('notifications.refreshed', steamid);
      } else {
        // Fetch more notifications
        await this.createJob(
          steamid,
          time,
          response.cursor.skip + response.cursor.limit,
          response.cursor.limit,
        );
      }
    });

    return response;
  }

  private async saveTempNotifications(
    steamid: SteamID,
    notifications: Notification[],
  ): Promise<void> {
    if (notifications.length === 0) {
      return;
    }

    const keys = await this.redis.keys(this.getKey(steamid) + ':*');

    const transaction = this.redis.multi();

    keys.forEach((key) => {
      transaction.hmset(key, ...this.flatMap(notifications));
    });

    await transaction.exec();
  }

  private flatMap(notifications: Notification[]): string[] {
    return notifications.flatMap((n) => [n.id, JSON.stringify(n)]);
  }

  @OnEvent('agents.registered')
  private async agentsRegistered(steamid: SteamID) {
    await this.refreshNotifications(steamid);
  }

  async createJob(
    steamid: SteamID,
    time: number = Date.now(),
    skip?: number,
    limit?: number,
  ) {
    await this.notificationsQueue.add(
      'fetch',
      {
        steamid64: steamid.getSteamID64(),
        time,
        skip,
        limit,
      },
      {
        jobId: steamid.getSteamID64() + ':' + time + ':' + skip + ':' + limit,
      },
    );
  }

  private getKey(steamid: SteamID) {
    return KEY_PREFIX + 'notifications:' + steamid.getSteamID64();
  }

  fetchNotifications(
    token: Token,
    skip?: number,
    limit?: number,
  ): Promise<GetNotificationsResponse> {
    return firstValueFrom(
      this.httpService.get('https://api.backpack.tf/api/notifications', {
        headers: {
          'X-Auth-Token': token.value,
        },
        timeout: 60000,
        params: {
          skip,
          limit,
        },
      }),
    ).then((response) => {
      return response.data;
    });
  }
}

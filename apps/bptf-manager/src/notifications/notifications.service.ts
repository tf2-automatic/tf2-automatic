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
import { pack, unpack } from 'msgpackr';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly httpService: HttpService,
    @InjectQueue('notifications')
    private readonly notificationsQueue: Queue<JobData>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async getNotifications(steamid: SteamID): Promise<Notification[]> {
    const values = await this.redis.hvalsBuffer(this.getKey(steamid));

    return values.map((raw) => {
      return unpack(raw) as Notification;
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
  ): Promise<void> {
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

    const key = this.getKey(steamid);
    const tempKey = key + ':' + time;

    if (response.results.length > 0) {
      await this.saveTempNotifications(steamid, response.results);

      await this.redis
        .multi()
        .hmset(tempKey, this.mapNotifications(response.results))
        .expire(tempKey, 5 * 60)
        .exec();
    }

    if (response.cursor.skip + response.cursor.limit < response.cursor.total) {
      // Fetch more notifications
      return this.createJob(
        steamid,
        time,
        response.cursor.skip + response.cursor.limit,
        response.cursor.limit,
      );
    }

    const exists = await this.redis.exists(tempKey);

    const transaction = this.redis.multi();

    if (exists) {
      transaction.copy(tempKey, this.getKey(steamid), 'REPLACE').persist(key);
    } else {
      transaction.del(key);
    }

    await transaction.exec();

    await this.eventEmitter.emitAsync('notifications.refreshed', steamid);
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
      transaction.hmset(key, this.mapNotifications(notifications));
    });

    await transaction.exec();
  }

  private mapNotifications(
    notifications: Notification[],
  ): Record<string, Buffer> {
    const result: Record<string, Buffer> = {};

    for (const notification of notifications) {
      result[notification.id] = pack(notification);
    }

    return result;
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
    return 'notifications:' + steamid.getSteamID64();
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

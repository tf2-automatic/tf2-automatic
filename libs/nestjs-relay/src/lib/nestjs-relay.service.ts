import { RedisService } from '@liaoliaots/nestjs-redis';
import {
  Injectable,
  OnApplicationBootstrap,
  OnModuleDestroy,
  Logger,
  Inject,
} from '@nestjs/common';
import { ChainableCommander, Redis } from 'ioredis';
import { SafeRedisLeader } from 'ts-safe-redis-leader';
import { NestEventsService } from '@tf2-automatic/nestjs-events';
import { BaseEvent, EventMetadata } from '@tf2-automatic/bot-data';
import { RelayModuleConfig } from '@tf2-automatic/config';
import { pack, unpack } from 'msgpackr';
import { OUTBOX_KEY } from './constants';
import { ClsService } from 'nestjs-cls';
import SteamID from 'steamid';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class RelayService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(RelayService.name);

  private leader: SafeRedisLeader;
  private isLeader = false;
  private working = false;
  private timeout: NodeJS.Timeout | null = null;

  private readonly outboxChannel: string;

  private readonly redis: Redis = this.redisService.getOrThrow();
  private readonly leaderRedis: Redis;
  private readonly subscriber: Redis;

  constructor(
    private readonly eventsService: NestEventsService,
    private readonly redisService: RedisService,
    @Inject('RELAY_CONFIG') config: RelayModuleConfig,
    private readonly cls: ClsService,
  ) {
    this.subscriber = new Redis(config.redis);
    this.leaderRedis = new Redis(config.redis);

    this.leader = new SafeRedisLeader(
      this.leaderRedis,
      config.relay.leaderTimeout,
      config.relay.leaderRenewTimeout,
      'publisher-leader-election',
    );

    this.outboxChannel = this.eventsService.getExchange() + ':' + OUTBOX_KEY;
  }

  publishEvent<Event extends BaseEvent<unknown>>(
    multi: ChainableCommander,
    type: Event['type'],
    data: Event['data'],
    steamid?: SteamID,
  ) {
    const metadata: EventMetadata = {
      id: uuidv4(),
      steamid64: steamid?.getSteamID64() ?? null,
      time: Math.floor(new Date().getTime() / 1000),
    };

    if (this.cls.isActive() && this.cls.has('userAgent')) {
      metadata.userAgent = this.cls.get('userAgent');
    }

    const event: BaseEvent<unknown> = {
      type,
      data,
      metadata,
    };

    // Add event to outbox
    multi
      .lpush(OUTBOX_KEY, pack(event))
      // Publish that there is a new event
      .publish(this.outboxChannel, '');
  }

  async onApplicationBootstrap() {
    this.leader.on('elected', () => {
      this.elected();
    });

    this.leader.on('demoted', () => {
      this.demoted();
    });

    // TODO: Subscribe to channel unique to the specific application.

    await this.subscriber.subscribe(this.outboxChannel);

    this.subscriber.on('message', (channel) => {
      if (channel !== OUTBOX_KEY) {
        return;
      }

      if (!this.isLeader) {
        return;
      }

      this.loop();
    });

    await this.leader.elect();
  }

  async onModuleDestroy() {
    this.clearTimeout();

    await this.leader.shutdown();

    await Promise.all([this.subscriber.quit(), this.leaderRedis.quit()]);
  }

  private clearTimeout() {
    if (this.timeout !== null) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
  }

  private elected() {
    this.logger.debug('Elected as leader');
    this.isLeader = true;
    this.loop();
  }

  private demoted() {
    this.logger.debug('No longer leader');
    this.isLeader = false;
    this.clearTimeout();
  }

  private loop() {
    if (this.working || !this.isLeader) {
      return;
    }

    this.working = true;

    let repeat = false;

    this.getMessageAndPublish()
      .then((processed) => {
        repeat = processed;
      })
      .finally(() => {
        this.working = false;

        if (repeat) {
          // We processed a message, try again immediately
          this.loop();
        } else {
          // We did not process a message, try again in a second
          this.clearTimeout();
          this.timeout = setTimeout(() => {
            this.loop();
          }, 1000);
        }
      });
  }

  private async getMessageAndPublish(): Promise<boolean> {
    this.isLeader = await this.leader.isLeader();
    if (!this.isLeader) {
      return false;
    }

    const message = await this.redis.lindexBuffer(OUTBOX_KEY, -1);
    if (!message) {
      return false;
    }

    const unpacked = unpack(message) as BaseEvent<string>;

    // Publish message
    await this.eventsService.publishEvent(unpacked);

    // Remove message from outbox
    await this.redis.lrem(OUTBOX_KEY, 1, message);

    return true;
  }
}

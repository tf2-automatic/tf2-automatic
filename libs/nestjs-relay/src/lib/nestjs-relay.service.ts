import { InjectRedis } from '@songkeys/nestjs-redis';
import {
  Injectable,
  OnApplicationBootstrap,
  OnModuleDestroy,
  Logger,
  Inject,
} from '@nestjs/common';
import { Redis } from 'ioredis';
import { SafeRedisLeader } from 'ts-safe-redis-leader';
import { NestEventsService } from '@tf2-automatic/nestjs-events';
import { OUTBOX_KEY } from '@tf2-automatic/transactional-outbox';
import { BaseEvent } from '@tf2-automatic/bot-data';
import { RelayModuleConfig } from '@tf2-automatic/config';

@Injectable()
export class RelayService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(RelayService.name);

  private leader: SafeRedisLeader;
  private isLeader = false;
  private working = false;
  private timeout: NodeJS.Timeout | null = null;

  private readonly leaderRedis: Redis;
  private readonly subscriber: Redis;

  constructor(
    private readonly eventsService: NestEventsService,
    @InjectRedis()
    private readonly redis: Redis,
    @Inject('RELAY_CONFIG') config: RelayModuleConfig,
  ) {
    this.subscriber = new Redis(config.redis);
    this.leaderRedis = new Redis(config.redis);

    this.leader = new SafeRedisLeader(
      this.leaderRedis,
      config.relay.leaderTimeout,
      config.relay.leaderRenewTimeout,
      'publisher-leader-election',
    );
  }

  async onApplicationBootstrap() {
    this.leader.on('elected', () => {
      this.elected();
    });

    this.leader.on('demoted', () => {
      this.demoted();
    });

    await this.subscriber.subscribe(OUTBOX_KEY);

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
    const isLeader = await this.leader.isLeader();
    this.isLeader = isLeader;

    if (!this.isLeader) {
      return false;
    }

    const message = await this.redis.lindex(OUTBOX_KEY, -1);
    if (!message) {
      return false;
    }

    const event = JSON.parse(message) as BaseEvent<string>;

    // Publish message
    await this.eventsService.publishEvent(event);

    // Remove message from outbox
    await this.redis.lrem(OUTBOX_KEY, 1, message);

    return true;
  }
}

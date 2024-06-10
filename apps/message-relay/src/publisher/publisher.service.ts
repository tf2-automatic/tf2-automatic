import { InjectRedis } from '@songkeys/nestjs-redis';
import {
  Injectable,
  OnApplicationBootstrap,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { Redis } from 'ioredis';
import { SafeRedisLeader } from 'ts-safe-redis-leader';
import { NestEventsService } from '@tf2-automatic/nestjs-events';
import { OUTBOX_KEY } from '@tf2-automatic/transactional-outbox';
import { BaseEvent } from '@tf2-automatic/bot-data';

@Injectable()
export class PublisherService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(PublisherService.name);

  private leader: SafeRedisLeader;
  private isLeader = false;
  private working = false;
  private timeout: NodeJS.Timeout;

  constructor(
    @InjectRedis('subscribe')
    private readonly redisSubcriber: Redis,
    @InjectRedis(OUTBOX_KEY)
    private readonly redisOutbox: Redis,
    @InjectRedis()
    private readonly redis: Redis,
    private readonly eventsService: NestEventsService,
  ) {}

  async onApplicationBootstrap() {
    this.leader = new SafeRedisLeader(
      this.redis,
      1000,
      2000,
      'publisher-leader-election',
    );

    this.leader.on('elected', () => {
      this.elected();
    });

    this.leader.on('demoted', () => {
      this.demoted();
    });

    await this.redisSubcriber.subscribe(OUTBOX_KEY);

    this.redisSubcriber.on('message', (channel) => {
      if (channel !== OUTBOX_KEY) {
        return;
      }

      if (!this.isLeader) {
        return;
      }

      this.logger.debug('Notified of a new message');

      this.loop();
    });

    await this.leader.elect();
  }

  async onModuleDestroy() {
    clearTimeout(this.timeout);
    await this.leader.shutdown();
  }

  private elected() {
    this.logger.log('Elected as leader');
    this.isLeader = true;
    this.loop();
  }

  private demoted() {
    this.logger.log('No longer leader');
    this.isLeader = false;
    clearTimeout(this.timeout);
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
          clearTimeout(this.timeout);
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

    const message = await this.redisOutbox.lindex(OUTBOX_KEY, -1);
    if (!message) {
      return false;
    }

    const event = JSON.parse(message) as BaseEvent<string>;

    const secondsAgo = Math.floor(Date.now() / 1000 - event.metadata.time);

    this.logger.debug(
      'Publishing message of type "' +
        event.type +
        '" made ' +
        (secondsAgo <= 0
          ? 'now'
          : secondsAgo +
            ' ' +
            (secondsAgo === 1 ? 'second' : 'seconds') +
            ' ago') +
        '...',
    );

    await this.eventsService.publishEvent(event);

    this.logger.debug('Message published, removing from outbox...');

    await this.redisOutbox.lrem(OUTBOX_KEY, 1, message);

    this.logger.debug('Removed from outbox');

    return true;
  }
}

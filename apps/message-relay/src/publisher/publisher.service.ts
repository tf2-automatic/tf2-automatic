import { InjectRedis } from '@liaoliaots/nestjs-redis';
import {
  Injectable,
  OnApplicationBootstrap,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { Redis } from 'ioredis';
import { createSafeRedisLeader } from 'safe-redis-leader';
import { EventsService } from '../events/events.service';
import { OutboxMessage, OUTBOX_KEY } from '@tf2-automatic/transactional-outbox';

@Injectable()
export class PublisherService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(PublisherService.name);

  private leader: any;
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
    private readonly eventsService: EventsService
  ) {}

  async onApplicationBootstrap() {
    this.leader = await createSafeRedisLeader({
      asyncRedis: this.redis,
      ttl: 1000,
      wait: 2000,
      key: 'publisher-leader-election',
    });

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

    const message = await this.redisOutbox.lindex(OUTBOX_KEY, 0);
    if (!message) {
      return false;
    }

    const event = JSON.parse(message) as OutboxMessage;

    const secondsAgo = Math.floor(
      Date.now() / 1000 - event.metadata.time
    ).toFixed(2);

    this.logger.debug(
      'Publishing message of type "' +
        event.type +
        '" made ' +
        secondsAgo +
        ' seconds ago...'
    );

    await this.eventsService.publish(event.type, event.data, event.metadata);

    this.logger.debug('Message published, removing from outbox...');

    await this.redisOutbox.lrem(OUTBOX_KEY, 1, message);

    this.logger.debug('Removed from outbox');

    return true;
  }
}

import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { BOT_EXCHANGE_NAME, BaseEvent } from '@tf2-automatic/bot-data';
import { CustomEventsService } from './custom.interface';
import { InjectRedis } from '@songkeys/nestjs-redis';
import { Redis } from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { Config } from '../../common/config/configuration';
import { EventsConfig } from '@tf2-automatic/config';

@Injectable()
export class RedisEventsService
  implements OnModuleDestroy, CustomEventsService
{
  private readonly persistEvents: boolean;

  constructor(
    @InjectRedis()
    private readonly redis: Redis,
    private readonly configService: ConfigService<Config>,
  ) {
    const config = this.configService.getOrThrow<EventsConfig>('events');
    this.persistEvents = config.persist;
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }

  async publish(_: string, data: BaseEvent<unknown>): Promise<void> {
    const event = JSON.stringify(data);

    if (this.persistEvents) {
      await this.redis
        .multi()
        .lpush(BOT_EXCHANGE_NAME, event)
        .publish(BOT_EXCHANGE_NAME, event)
        .exec();
    } else {
      await this.redis.publish(BOT_EXCHANGE_NAME, event);
    }
  }
}

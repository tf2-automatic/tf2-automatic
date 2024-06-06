import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { BOT_EXCHANGE_NAME, BaseEvent } from '@tf2-automatic/bot-data';
import { CustomEventsService } from './custom.interface';
import { InjectRedis } from '@songkeys/nestjs-redis';
import { Redis } from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { Config, RedisEventsConfig } from '../../common/config/configuration';

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
    const config = this.configService.getOrThrow<RedisEventsConfig>('events');
    this.persistEvents = config.persist;
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }

  async publish(type: string, data: BaseEvent<unknown>): Promise<void> {
    const event = JSON.stringify(data);

    if (this.persistEvents) {
      await this.redis
        .multi()
        .lpush(BOT_EXCHANGE_NAME, event)
        .publish(BOT_EXCHANGE_NAME, type)
        .exec();
    } else {
      await this.redis.publish(BOT_EXCHANGE_NAME, event);
    }
  }
}

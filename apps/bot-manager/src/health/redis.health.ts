import { InjectRedis } from '@songkeys/nestjs-redis';
import { Injectable } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { Redis } from 'ioredis';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(
    @InjectRedis()
    private readonly redis: Redis
  ) {
    super();
  }

  isHealthy(key: string): Promise<HealthIndicatorResult> {
    return this.redis
      .ping()
      .then(() => {
        return this.getStatus(key, true);
      })
      .catch((err) => {
        throw new HealthCheckError(
          'Redis check failed',
          this.getStatus(key, false, { message: err.message })
        );
      });
  }
}

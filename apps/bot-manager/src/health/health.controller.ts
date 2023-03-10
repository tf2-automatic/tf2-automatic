import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { HEALTH_BASE_URL, HEALTH_PATH } from '@tf2-automatic/bot-manager-data';
import { RedisHealthIndicator } from './redis.health';

@Controller(HEALTH_BASE_URL)
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly redisHealthIndicator: RedisHealthIndicator
  ) {}

  @Get(HEALTH_PATH)
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.redisHealthIndicator.isHealthy('redis'),
    ]);
  }
}

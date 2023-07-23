import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { HEALTH_BASE_URL, HEALTH_PATH } from '@tf2-automatic/bot-manager-data';
import { RedisHealthIndicator } from './redis.health';

@ApiTags('Health')
@Controller(HEALTH_BASE_URL)
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly redisHealthIndicator: RedisHealthIndicator,
  ) {}

  @Get(HEALTH_PATH)
  @HealthCheck()
  @ApiOperation({
    summary: 'Health check',
    description: 'Check if the bot manager is healthy.',
  })
  check() {
    return this.health.check([
      () => this.redisHealthIndicator.isHealthy('redis'),
    ]);
  }
}

import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { HEALTH_BASE_URL, HEALTH_PATH } from '@tf2-automatic/bot-data';
import { BotHealthIndicator } from './bot.health';

@Controller(HEALTH_BASE_URL)
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly botHealthIndicator: BotHealthIndicator
  ) {}

  @Get(HEALTH_PATH)
  @HealthCheck()
  check() {
    return this.health.check([() => this.botHealthIndicator.isHealthy('bot')]);
  }
}

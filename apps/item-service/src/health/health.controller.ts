import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { HealthCheck } from '@nestjs/terminus';
import { HEALTH_BASE_URL, HEALTH_PATH } from '@tf2-automatic/bot-manager-data';
import { HealthService } from './health.service';

@ApiTags('Health')
@Controller(HEALTH_BASE_URL)
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get(HEALTH_PATH)
  @HealthCheck()
  @ApiOperation({
    summary: 'Health check',
    description: 'Check if the bot manager is healthy.',
  })
  check() {
    return this.healthService.check();
  }
}

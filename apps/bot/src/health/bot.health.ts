import { Injectable } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { BotService } from '../bot/bot.service';

@Injectable()
export class BotHealthIndicator extends HealthIndicator {
  constructor(private readonly botService: BotService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const readyOrReason = await this.botService.isReady();
    if (readyOrReason === true) {
      return this.getStatus(key, true);
    }

    throw new HealthCheckError(
      'Bot check failed',
      this.getStatus(key, false, { message: readyOrReason }),
    );
  }
}

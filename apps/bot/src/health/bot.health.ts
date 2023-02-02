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
    const isReady = await this.botService.isReady();

    if (isReady) {
      return Promise.resolve(this.getStatus(key, true));
    } else {
      throw new HealthCheckError(
        'Bot check failed',
        this.getStatus(key, false, { message: 'Not ready' })
      );
    }
  }
}

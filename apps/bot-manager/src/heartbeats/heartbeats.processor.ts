import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import {
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Job } from 'bullmq';
import { HeartbeatsService } from '../heartbeats/heartbeats.service';
import { HeartbeatsQueue } from './interfaces/queue.interface';
import SteamID from 'steamid';

@Processor('heartbeats')
export class HeartbeatsProcessor extends WorkerHost {
  private readonly logger = new Logger(HeartbeatsProcessor.name);

  constructor(private readonly heartbeatsService: HeartbeatsService) {
    super();
  }

  async process(job: Job<HeartbeatsQueue>): Promise<void> {
    const { steamid64 } = job.data;

    this.logger.warn('Missed heartbeat from bot ' + steamid64);

    try {
      // Check if the bot exists and is running
      const bot = await this.heartbeatsService.getBot(new SteamID(steamid64));

      // Check if the bot has sent a heartbeat recently
      if (bot.lastSeen === job.data.lastSeen) {
        // Bot has not sent a new heartbeat, mark it as stopped
        return this.heartbeatsService.markStopped(
          new SteamID(steamid64),
          false,
        );
      }
    } catch (err) {
      if (err instanceof NotFoundException) {
        // Bot does not exist, do nothing
        return;
      } else if (err instanceof InternalServerErrorException) {
        // Bot is not running / not available, mark it as stopped
        return this.heartbeatsService.markStopped(
          new SteamID(steamid64),
          false,
        );
      } else {
        // Unexpected error
        throw err;
      }
    }
  }

  @OnWorkerEvent('error')
  onError(err: Error): void {
    this.logger.error('Error in worker');
    console.error(err);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<HeartbeatsQueue>, err: Error): void {
    this.logger.warn(`Failed job ${job.id}: ${err.message}`);
  }
}

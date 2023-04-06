import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { HttpError } from '@tf2-automatic/bot-data';
import { AxiosError } from 'axios';
import { Job, MinimalJob, UnrecoverableError } from 'bullmq';
import { InventoryQueue } from './interfaces/queue.interfaces';
import { customBackoffStrategy } from '../common/utils/backoff-strategy';
import { InventoriesService } from './inventories.service';
import { HeartbeatsService } from '../heartbeats/heartbeats.service';
import SteamID from 'steamid';
import { Bot } from '@tf2-automatic/bot-manager-data';

@Processor('inventories', {
  settings: {
    backoffStrategy: (attempts: number, _, __, job: MinimalJob) => {
      return customBackoffStrategy(attempts, job);
    },
  },
  limiter: {
    max: 1,
    duration: 1000,
  },
})
export class InventoriesProcessor extends WorkerHost {
  private readonly logger = new Logger(InventoriesProcessor.name);

  constructor(
    private readonly inventoriesService: InventoriesService,
    private readonly heartbeatsService: HeartbeatsService
  ) {
    super();
  }

  async process(job: Job<InventoryQueue>): Promise<unknown> {
    this.logger.log(`Processing job ${job.id} attempt #${job.attemptsMade}...`);

    const maxTime = job.data?.retry?.maxTime ?? 120000;

    // Check if job is too old
    if (job.timestamp < Date.now() - maxTime) {
      throw new UnrecoverableError('Job is too old');
    }

    try {
      // Work on job
      const result = await this.handleJob(job);
      return result;
    } catch (err) {
      if (err instanceof AxiosError) {
        const response =
          err.response satisfies AxiosError<HttpError>['response'];

        if (
          response !== undefined &&
          response.status < 500 &&
          response.status >= 400
        ) {
          // Don't retry on 4xx errors
          throw new UnrecoverableError(response.data.message);
        }
      }

      // Check if job will be too old when it can be retried again
      const delay = customBackoffStrategy(job.attemptsMade, job);
      if (job.timestamp < Date.now() + delay - maxTime) {
        throw new UnrecoverableError('Job is too old to be retried');
      }

      // Unknown error
      throw err;
    }
  }

  private async handleJob(job: Job<InventoryQueue>): Promise<unknown> {
    let bot: Bot;

    if (job.data.bot) {
      const botSteamID = new SteamID(job.data.bot);

      bot = await this.heartbeatsService.getBot(botSteamID).catch((err) => {
        throw new Error(err.message);
      });
    } else {
      // Get list of bots
      const bots = await this.heartbeatsService.getBots();
      if (bots.length === 0) {
        throw new Error('No bots available');
      }

      bot = bots[Math.floor(Math.random() * bots.length)];
    }

    this.logger.debug(`Bot ${bot.steamid64} selected`);

    // Get and save inventory
    const inventory = await this.inventoriesService.getInventoryFromBot(
      bot,
      new SteamID(job.data.raw.steamid),
      job.data.raw.appid,
      job.data.raw.contextid
    );

    return inventory.timestamp;
  }

  @OnWorkerEvent('error')
  onError(err: Error): void {
    this.logger.error('Error in worker');
    console.error(err);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<InventoryQueue>, err: Error): void {
    this.logger.warn(`Failed job ${job.id}: ${err.message}`);
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<InventoryQueue>): void {
    this.logger.log(`Completed job ${job.id}`);
  }
}

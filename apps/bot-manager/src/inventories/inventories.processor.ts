import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { HttpError } from '@tf2-automatic/bot-data';
import { AxiosError } from 'axios';
import { Job, UnrecoverableError } from 'bullmq';
import { InventoryQueue } from './interfaces/queue.interfaces';
import {
  bullWorkerSettings,
  customBackoffStrategy,
} from '../common/utils/backoff-strategy';
import { InventoriesService } from './inventories.service';
import { HeartbeatsService } from '../heartbeats/heartbeats.service';
import SteamID from 'steamid';
import {
  Bot,
  INVENTORY_ERROR_EVENT,
  INVENTORY_FAILED_EVENT,
  InventoryErrorEvent,
  InventoryFailedEvent,
} from '@tf2-automatic/bot-manager-data';
import {
  CustomError,
  CustomUnrecoverableError,
} from '../common/utils/custom-queue-errors';
import { NestEventsService } from '@tf2-automatic/nestjs-events';
import assert from 'node:assert';

@Processor('inventories', {
  settings: bullWorkerSettings,
  limiter: {
    max: 1,
    duration: 1000,
  },
})
export class InventoriesProcessor extends WorkerHost {
  private readonly logger = new Logger(InventoriesProcessor.name);

  constructor(
    private readonly inventoriesService: InventoriesService,
    private readonly heartbeatsService: HeartbeatsService,
    private readonly eventsService: NestEventsService,
  ) {
    super();
  }

  async process(job: Job<InventoryQueue>): Promise<unknown> {
    this.logger.log(`Processing job ${job.id} attempt #${job.attemptsMade}...`);

    return this.processJobWithErrorHandler(job).catch((err) => {
      const data: (InventoryErrorEvent | InventoryFailedEvent)['data'] = {
        job: job.data.raw,
        error: err.message,
        response: null,
      };

      if (
        err instanceof CustomError ||
        err instanceof CustomUnrecoverableError
      ) {
        data.response = err.response.data;
      }

      const unrecoverable = err instanceof UnrecoverableError;

      return this.eventsService
        .publish(
          unrecoverable ? INVENTORY_ERROR_EVENT : INVENTORY_FAILED_EVENT,
          data,
        )
        .finally(() => {
          throw err;
        });
    });
  }

  private async selectBot(job: Job<InventoryQueue>): Promise<Bot> {
    if (job.data.bot) {
      const botSteamID = new SteamID(job.data.bot);

      return this.heartbeatsService.getBot(botSteamID).catch((err) => {
        throw new Error(err.message);
      });
    }

    // Get list of bots
    const bots = await this.heartbeatsService.getRunningBots();
    if (bots.length === 0) {
      throw new Error('No bots available');
    }

    let minAttempts = Number.MAX_SAFE_INTEGER;
    let minAttemptsBots: Bot[] = [];

    for (const bot of bots) {
      const attempts = job.data.extra.botsAttempted?.[bot.steamid64] ?? 0;

      if (attempts < minAttempts) {
        minAttempts = attempts;
        minAttemptsBots = [bot];
      } else if (attempts === minAttempts) {
        minAttemptsBots.push(bot);
      }
    }

    assert(minAttemptsBots.length > 0, 'No bots after filtering by attempts');

    // TODO: Filter bots by who they are friends with

    // Select bots with the least attempts made
    return minAttemptsBots[Math.floor(Math.random() * minAttemptsBots.length)];
  }

  private async processJobWithErrorHandler(
    job: Job<InventoryQueue>,
  ): Promise<unknown> {
    const maxTime = job.data?.retry?.maxTime ?? 120000;

    // Check if job is too old
    if (job.timestamp < Date.now() - maxTime) {
      throw new UnrecoverableError('Job is too old');
    }

    const bot = await this.selectBot(job);

    this.logger.debug(`Bot ${bot.steamid64} selected`);

    try {
      // Work on job
      const result = await this.handleJob(job, bot);
      return result;
    } catch (err) {
      if (err instanceof AxiosError && err.response !== undefined) {
        const response =
          err.response satisfies AxiosError<HttpError>['response'];

        const botsAttempted = job.data.extra.botsAttempted ?? {};
        botsAttempted[bot.steamid64] = (botsAttempted[bot.steamid64] ?? 0) + 1;

        job.data.extra.botsAttempted = botsAttempted;

        await job.updateData(job.data).catch(() => {
          // Ignore error
        });

        if (response.status === 401 && !job.data.bot) {
          // Retry loading the inventory (hopefully with a different bot)
          throw err;
        }

        if (response.status < 500 && response.status >= 400) {
          // Don't retry on 4xx errors
          throw new CustomUnrecoverableError(response.data.message, response);
        }
      }

      // Check if job will be too old when it can be retried again
      const delay = customBackoffStrategy(job.attemptsMade, job);
      if (job.timestamp < Date.now() + delay - maxTime) {
        if (err instanceof AxiosError && err.response !== undefined) {
          throw new CustomUnrecoverableError(
            'Job is too old to be retried',
            err.response,
          );
        }

        throw new UnrecoverableError('Job is too old to be retried');
      }

      if (err instanceof AxiosError && err.response !== undefined) {
        throw new CustomError(err.response.data.message, err.response);
      }

      // Unknown error
      throw err;
    }
  }

  private async handleJob(
    job: Job<InventoryQueue>,
    bot: Bot,
  ): Promise<unknown> {
    // Get and save inventory
    const inventory = await this.inventoriesService.getInventoryFromBot(
      bot,
      new SteamID(job.data.raw.steamid64),
      job.data.raw.appid,
      job.data.raw.contextid,
      job.data.ttl,
      job.data.tradableOnly,
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

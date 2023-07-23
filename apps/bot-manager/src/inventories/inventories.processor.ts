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
import { EventsService } from '../events/events.service';

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
    private readonly heartbeatsService: HeartbeatsService,
    private readonly eventsService: EventsService,
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

  private async processJobWithErrorHandler(
    job: Job<InventoryQueue>,
  ): Promise<unknown> {
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

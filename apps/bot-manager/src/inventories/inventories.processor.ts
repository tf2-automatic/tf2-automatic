import { Processor } from '@nestjs/bullmq';
import { UnrecoverableError } from 'bullmq';
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
import { NestEventsService } from '@tf2-automatic/nestjs-events';
import assert from 'node:assert';
import {
  CustomJob,
  CustomWorkerHost,
  CustomError,
  CustomUnrecoverableError,
  bullWorkerSettings,
} from '@tf2-automatic/queue';
import { ClsService } from 'nestjs-cls';
import { AxiosError } from 'axios';
import { InventoryJobData } from './inventories.types';

@Processor('inventories', {
  settings: bullWorkerSettings,
  limiter: {
    max: 1,
    duration: 1000,
  },
})
export class InventoriesProcessor extends CustomWorkerHost<InventoryJobData> {
  constructor(
    private readonly inventoriesService: InventoriesService,
    private readonly heartbeatsService: HeartbeatsService,
    private readonly eventsService: NestEventsService,
    private readonly cls: ClsService,
  ) {
    super(cls);
  }

  async errorHandler(
    job: CustomJob<InventoryJobData>,
    err: any,
  ): Promise<void> {
    if (err instanceof AxiosError && err.response !== undefined) {
      const botsAttempted = job.data.state.botsAttempted ?? {};

      const bot: string | undefined = this.cls.get('bot');
      assert(bot !== undefined, 'Bot is not set');

      botsAttempted[bot] = (botsAttempted[bot] ?? 0) + 1;

      job.data.state.botsAttempted = botsAttempted;

      await job.updateData(job.data).catch(() => {
        // Ignore error
      });
    }
  }

  async processJob(job: CustomJob<InventoryJobData>) {
    const bot = await this.selectBot(job);

    this.logger.debug(`Bot ${bot.steamid64} selected`);

    this.cls.set('bot', bot.steamid64);

    return this.handleJob(job, bot).catch(async (err) => {
      const data: (InventoryErrorEvent | InventoryFailedEvent)['data'] = {
        job: job.data.options,
        error: err.message,
        response: null,
      };

      if (
        err instanceof CustomError ||
        err instanceof CustomUnrecoverableError
      ) {
        data.response = err.response;
      }

      const unrecoverable = err instanceof UnrecoverableError;

      return this.eventsService
        .publish(
          unrecoverable ? INVENTORY_ERROR_EVENT : INVENTORY_FAILED_EVENT,
          data,
          new SteamID(job.data.options.steamid64),
        )
        .finally(() => {
          throw err;
        });
    });
  }

  private async selectBot(job: CustomJob<InventoryJobData>): Promise<Bot> {
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
      const attempts = job.data.state.botsAttempted?.[bot.steamid64] ?? 0;

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

  private async handleJob(
    job: CustomJob<InventoryJobData>,
    bot: Bot,
  ): Promise<unknown> {
    // Get and save inventory
    const inventory = await this.inventoriesService.getInventoryFromBot(
      bot,
      new SteamID(job.data.options.steamid64),
      job.data.options.appid,
      job.data.options.contextid,
      job.data.options.ttl,
    );

    return inventory.timestamp;
  }
}

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
import {
  CustomJob,
  CustomWorkerHost,
  CustomError,
  CustomUnrecoverableError,
  bullWorkerSettings,
  selectBot,
  botAttemptErrorHandler,
} from '@tf2-automatic/queue';
import { ClsService } from 'nestjs-cls';
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
    return botAttemptErrorHandler(this.cls, err, job);
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

    return selectBot(job, bots);
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

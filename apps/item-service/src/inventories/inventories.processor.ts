import { Processor } from '@nestjs/bullmq';
import { InventoriesService } from './inventories.service';
import {
  CustomJob,
  CustomWorkerHost,
  bullWorkerSettings,
  JobData,
  CustomError,
  CustomUnrecoverableError,
} from '@tf2-automatic/queue';
import { ClsService } from 'nestjs-cls';
import SteamID from 'steamid';
import {
  INVENTORY_ERROR_EVENT,
  INVENTORY_FAILED_EVENT,
  InventoryErrorEvent,
  InventoryFailedEvent,
  InventoryJobOptions,
} from '@tf2-automatic/item-service-data';
import { UnrecoverableError } from 'bullmq';
import { NestEventsService } from '@tf2-automatic/nestjs-events';

type InventoryJobData = JobData<InventoryJobOptions>;

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
    private readonly eventsService: NestEventsService,
    private readonly cls: ClsService,
  ) {
    super(cls);
  }

  async postErrorHandler(
    job: CustomJob<InventoryJobData>,
    err: any,
  ): Promise<void> {
    if (!(err instanceof CustomUnrecoverableError)) {
      return;
    }

    await this.inventoriesService.saveInventory(
      new SteamID(job.data.options.steamid64),
      {
        timestamp: this.cls.get('timestamp'),
        error: err.response,
        result: null,
        ttl: job.data.options.ttl,
      },
    );
  }

  async processJob(job: CustomJob<InventoryJobData>) {
    return this.handleJob(job).catch(async (err) => {
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

  private async handleJob(job: CustomJob<InventoryJobData>): Promise<void> {
    const steamid = new SteamID(job.data.options.steamid64);

    const inventory = await this.inventoriesService.fetchInventoryBySteamID(
      steamid,
      // TODO: Implement idempotency store in redis for the bot-manager
      job.attemptsMade > 0,
    );

    await this.inventoriesService.saveInventory(steamid, {
      result: inventory,
      error: null,
      timestamp: this.cls.get('timestamp'),
      ttl: job.data.options.ttl,
    });
  }
}

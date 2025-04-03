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
    cls: ClsService,
  ) {
    super(cls);
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

  private async handleJob(job: CustomJob<InventoryJobData>): Promise<unknown> {
    // Get and save inventory
    const inventory = await this.inventoriesService.fetchInventoryBySteamID(
      new SteamID(job.data.options.steamid64),
      [],
      job.attemptsMade > 0,
      job.data.options.ttl,
    );

    return inventory.timestamp;
  }
}

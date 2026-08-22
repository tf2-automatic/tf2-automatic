import { Processor } from '@nestjs/bullmq';
import { InventoriesService } from './inventories.service';
import {
  CustomJob,
  CustomWorkerHost,
  bullWorkerSettings,
  JobData,
  CustomUnrecoverableError,
  errorToEvent,
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

  async onJobFailed(
    job: CustomJob<InventoryJobData>,
    err: unknown,
  ): Promise<void> {
    const { unrecoverable, error, response } = errorToEvent(err);

    const data: (InventoryErrorEvent | InventoryFailedEvent)['data'] = {
      job: job.data.options,
      error,
      response,
    };

    await this.eventsService.publish(
      unrecoverable ? INVENTORY_ERROR_EVENT : INVENTORY_FAILED_EVENT,
      data,
      new SteamID(job.data.options.steamid64),
    );

    if (err instanceof CustomUnrecoverableError) {
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
  }

  async processJob(job: CustomJob<InventoryJobData>): Promise<void> {
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

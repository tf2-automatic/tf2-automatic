import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InventoriesService } from '../inventories.service';
import { Job } from 'bullmq';
import SteamID from 'steamid';
import { TokensService } from '../../tokens/tokens.service';
import {
  InventoriesJobData,
  InventoriesJobResult,
} from '../interfaces/queue.interface';

@Processor('inventories')
export class InventoriesProcessor extends WorkerHost {
  private readonly logger = new Logger(InventoriesProcessor.name);

  constructor(
    private readonly inventoriesService: InventoriesService,
    private readonly tokensService: TokensService,
  ) {
    super();
  }

  async process(
    job: Job<InventoriesJobData, InventoriesJobResult>,
  ): Promise<InventoriesJobResult> {
    this.logger.log(
      `Refreshing inventory for ${job.data.steamid64} attempt #${
        job.data.attemptsSinceLastRefresh + 1
      }...`,
    );

    const steamid = new SteamID(job.data.steamid64);

    const [inventory, status] = await Promise.all([
      // Get the status of the inventory when it was last requested to be refreshed
      this.inventoriesService.getInventory(steamid),
      // Refresh the inventory
      this.tokensService.getRandomToken().then((token) => {
        return this.inventoriesService.refreshInventory(steamid, token.value);
      }),
    ]);

    this.logger.debug(
      'Last snapshot for ' +
        steamid.getSteamID64() +
        ' was made ' +
        (status.current_time - status.timestamp) +
        ' second(s) ago',
    );

    // If the inventory was refreshed since the job started
    const refreshed = status.timestamp > job.data.refreshed;

    // Check if the inventory has been refreshed since we last requested it to be refreshed
    if (refreshed && inventory !== null) {
      // Get the refresh point of the inventory
      const refreshPoint = await this.inventoriesService.getRefreshPoint(
        steamid,
      );

      // Check if the inventory was refreshed after the refresh point
      if (refreshPoint === null || inventory.refresh >= refreshPoint) {
        // Inventory has been refreshed since we last requested it to be refreshed
        // and it was refreshed after the refresh point
        return { done: true, status: inventory.status };
      }
    }

    // Add a new job to the queue to continue refreshing the inventory
    await this.inventoriesService.enqueueRefresh(
      steamid,
      status,
      job.data.attempts + 1,
      refreshed ? 0 : job.data.attemptsSinceLastRefresh + 1,
    );

    return {
      done: false,
      status,
    };
  }

  @OnWorkerEvent('error')
  onError(err: Error): void {
    this.logger.error('Error in worker');
    console.error(err);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<InventoriesJobData>, err: Error): void {
    this.logger.warn(
      `Failed to request refresh for ${job.data.steamid64}: ${err.message}`,
    );
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<InventoriesJobData, InventoriesJobResult>): void {
    if (job.returnvalue.done) {
      this.logger.log(
        `Inventory has been updated for ${
          job.data.steamid64
        } after a total of ${job.data.attempts + 1} attempt(s)`,
      );
    }
  }
}

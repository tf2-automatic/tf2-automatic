import { OnWorkerEvent, Processor } from '@nestjs/bullmq';
import { ClsService } from 'nestjs-cls';
import { AccountWorkerHost } from '../../common/account-worker-host';
import { bullWorkerSettings } from '@tf2-automatic/queue';
import { Logger } from '@nestjs/common';
import { InventoriesService } from '../inventories.service';
import { Job } from 'bullmq';
import SteamID from 'steamid';
import { TokensService } from '../../tokens/tokens.service';
import {
  InventoriesJobData,
  InventoriesJobResult,
} from '../interfaces/queue.interface';

@Processor('inventories', {
  settings: bullWorkerSettings,
})
export class InventoriesProcessor extends AccountWorkerHost {
  private readonly logger = new Logger(InventoriesProcessor.name);

  constructor(
    private readonly inventoriesService: InventoriesService,
    private readonly tokensService: TokensService,
    cls: ClsService,
  ) {
    super(cls);
  }

  async processJob(
    job: Job<InventoriesJobData, InventoriesJobResult>,
  ): Promise<InventoriesJobResult> {
    this.logger.debug(
      `Refreshing inventory attempt #${
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
      'Last inventory snapshot was made ' +
        (status.current_time - status.timestamp) +
        ' second(s) ago',
    );

    return this.inventoriesService.continueRefresh(
      steamid,
      status,
      inventory,
      job.data,
    );
  }

  @OnWorkerEvent('error')
  onError(err: Error): void {
    this.logger.error('Error in worker');
    console.error(err);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<InventoriesJobData>, err: Error): void {
    this.logger.warn(`Failed to request inventory refresh: ${err.message}`);
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<InventoriesJobData, InventoriesJobResult>): void {
    if (job.returnvalue.done && !job.returnvalue.cancelled) {
      this.logger.log(
        `Inventory has been updated after a total of ${job.data.attempts + 1} attempt(s)`,
      );
    }
  }
}

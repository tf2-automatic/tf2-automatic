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
  EnqueueJobData,
  EnqueueJobResult,
} from '../interfaces/queue.interface';

@Processor('enqueueInventories', {
  settings: bullWorkerSettings,
})
export class EnqueueInventoriesProcessor extends AccountWorkerHost {
  private readonly logger = new Logger(EnqueueInventoriesProcessor.name);

  constructor(
    private readonly inventoriesService: InventoriesService,
    private readonly tokensService: TokensService,
    cls: ClsService,
  ) {
    super(cls);
  }

  async processJob(
    job: Job<EnqueueJobData, EnqueueJobResult>,
  ): Promise<EnqueueJobResult> {
    this.logger.debug(
      `Scheduling inventory refresh attempt #${job.attemptsMade}...`,
    );

    const token = await this.tokensService.getRandomToken();

    const steamid = new SteamID(job.data.steamid64);

    const result = await this.inventoriesService.getInventoryStatus(
      steamid,
      token.value,
    );

    // A missing refresh point means the refresh was cancelled
    if ((await this.inventoriesService.getRefreshPoint(steamid)) !== null) {
      await this.inventoriesService.enqueueRefresh(steamid, result);
    }

    return result;
  }

  @OnWorkerEvent('error')
  onError(err: Error): void {
    this.logger.error('Error in worker');
    console.error(err);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<EnqueueJobData>, err: Error): void {
    this.logger.warn(`Failed to schedule inventory refresh: ${err.message}`);
  }
}

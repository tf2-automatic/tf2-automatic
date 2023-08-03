import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InventoriesService } from '../inventories.service';
import { Job } from 'bullmq';
import SteamID from 'steamid';
import { TokensService } from '../../tokens/tokens.service';
import {
  EnqueueJobData,
  EnqueueJobResult,
} from '../interfaces/queue.interface';

@Processor('enqueueInventories')
export class EnqueueInventoriesProcessor extends WorkerHost {
  private readonly logger = new Logger(EnqueueInventoriesProcessor.name);

  constructor(
    private readonly inventoriesService: InventoriesService,
    private readonly tokensService: TokensService,
  ) {
    super();
  }

  async process(
    job: Job<EnqueueJobData, EnqueueJobResult>,
  ): Promise<EnqueueJobResult> {
    this.logger.debug(
      `Scheduling refresh job for ${job.data.steamid64} attempt #${job.attemptsMade}...`,
    );

    const token = await this.tokensService.getRandomToken();

    const steamid = new SteamID(job.data.steamid64);

    const result = await this.inventoriesService.getInventoryStatus(
      steamid,
      token.token,
    );

    await this.inventoriesService.enqueueRefresh(steamid, result);

    return result;
  }

  @OnWorkerEvent('error')
  onError(err: Error): void {
    this.logger.error('Error in worker');
    console.error(err);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<EnqueueJobData>, err: Error): void {
    this.logger.warn(
      `Failed to schedule refresh job for ${job.data.steamid64}: ${err.message}`,
    );
  }
}

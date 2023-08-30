import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { CurrentListingsService } from '../current-listings.service';
import { TokensService } from '../../tokens/tokens.service';
import SteamID from 'steamid';
import { AxiosError } from 'axios';
import { JobData, JobType } from '../interfaces/get-listings.queue.interface';

@Processor('get-listings', {
  concurrency: 2,
})
export class GetListingsProcessor extends WorkerHost {
  private readonly logger = new Logger(GetListingsProcessor.name);

  constructor(
    private readonly currentListingsService: CurrentListingsService,
    private readonly tokensService: TokensService,
  ) {
    super();
  }

  async process(job: Job<JobData, unknown, JobType>): Promise<void> {
    this.logger.debug('Processing job ' + job.id);

    const steamid = new SteamID(job.data.steamid64);

    const token = await this.tokensService.getToken(steamid);

    await this.currentListingsService.getListingsAndContinue(
      token,
      job.name,
      job.data.start ?? Date.now(),
      job.data.skip,
      job.data.limit,
    );
  }

  @OnWorkerEvent('error')
  onError(err: Error): void {
    this.logger.error('Error in worker');
    console.error(err);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error): void {
    this.logger.warn(
      `Failed to refresh listings for job ${job.id}: ${err.message}`,
    );

    if (err instanceof AxiosError) {
      console.error('Status code ' + err.response?.status);
      console.error(err.response?.data);
    } else {
      console.error(err);
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job): void {
    this.logger.debug('Completed job ' + job.id);
  }
}

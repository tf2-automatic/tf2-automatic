import { OnWorkerEvent, Processor } from '@nestjs/bullmq';
import { ClsService } from 'nestjs-cls';
import { AccountWorkerHost } from '../../common/account-worker-host';
import { bullWorkerSettings } from '@tf2-automatic/queue';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { CurrentListingsService } from '../current-listings.service';
import { TokensService } from '../../tokens/tokens.service';
import SteamID from 'steamid';
import { AxiosError } from 'axios';
import { JobData, JobType } from '../interfaces/get-listings.queue.interface';
import { GetListingsResponse } from '../interfaces/bptf.interface';
import { RateLimitedEndpoint } from '../../common/config/configuration';
import { RateLimitsService } from '../../rate-limits/rate-limits.service';

@Processor('get-listings', {
  settings: bullWorkerSettings,
  concurrency: 2,
})
export class GetListingsProcessor extends AccountWorkerHost {
  private readonly logger = new Logger(GetListingsProcessor.name);

  constructor(
    private readonly currentListingsService: CurrentListingsService,
    private readonly tokensService: TokensService,
    private readonly rateLimitsService: RateLimitsService,
    cls: ClsService,
  ) {
    super(cls);
  }

  async processJob(
    job: Job<JobData, unknown, JobType>,
    lockToken?: string,
  ): Promise<void> {
    switch (job.name) {
      case JobType.Done:
        await this.doneGettingListings(job);
        break;
      case JobType.Active:
      case JobType.Archived:
        await this.getListings(job, lockToken);
        break;
      default:
        this.logger.error('Unknown job type ' + job.name);
    }
  }

  private async doneGettingListings(
    job: Job<JobData, unknown, JobType>,
  ): Promise<void> {
    await this.currentListingsService.handleListingsFetched(
      new SteamID(job.data.steamid64),
      job.data.start,
    );
  }

  private async getListings(
    job: Job<JobData, unknown, JobType>,
    lockToken?: string,
  ): Promise<void> {
    const steamid = new SteamID(job.data.steamid64);

    const token = await this.tokensService.getToken(steamid);

    const skip = job.data.skip;
    const limit = job.data.limit;

    let fetch: () => Promise<GetListingsResponse>;
    let endpoint: RateLimitedEndpoint;

    if (job.name === JobType.Active) {
      fetch = () =>
        this.currentListingsService.fetchActiveListings(token, skip, limit);
      endpoint = 'listingsGet';
    } else if (job.name === JobType.Archived) {
      fetch = () =>
        this.currentListingsService.fetchArchivedListings(token, skip, limit);
      endpoint = 'archiveGet';
    } else {
      return;
    }

    const key = steamid.getSteamID64();

    let start = 0;

    const response = await this.rateLimitsService.scheduleOrDelay(
      job,
      lockToken,
      endpoint,
      key,
      () => {
        start = Date.now();

        return fetch().catch((err) =>
          this.rateLimitsService.handleError(endpoint, key, err),
        );
      },
    );

    const duration = Date.now() - start;

    this.logger.debug(
      `Got ${response.results.length} ${job.name} listing(s) (${response.cursor.skip + response.results.length} of ${response.cursor.total}) in ${duration}ms`,
    );

    await this.currentListingsService.handleListingsResponse(job, response);
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
}

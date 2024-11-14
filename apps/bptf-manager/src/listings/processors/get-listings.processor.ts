import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { CurrentListingsService } from '../current-listings.service';
import { TokensService } from '../../tokens/tokens.service';
import SteamID from 'steamid';
import { AxiosError } from 'axios';
import { JobData, JobType } from '../interfaces/get-listings.queue.interface';
import { GetListingsResponse } from '../interfaces/bptf.interface';

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
    switch (job.name) {
      case JobType.Done:
        await this.doneGettingListings(job);
        break;
      case JobType.Active:
      case JobType.Archived:
        await this.getListings(job);
        break;
      default:
        this.logger.warn('Unknown job type ' + job.name);
    }
  }

  private async doneGettingListings(
    job: Job<JobData, unknown, JobType>,
  ): Promise<void> {
    const steamid = new SteamID(job.data.steamid64);

    await this.currentListingsService.handleListingsFetched(
      new SteamID(job.data.steamid64),
      job.data.start,
    );

    this.logger.debug('Refreshed listings for ' + steamid);
  }

  private async getListings(
    job: Job<JobData, unknown, JobType>,
  ): Promise<void> {
    const steamid = new SteamID(job.data.steamid64);

    const token = await this.tokensService.getToken(steamid);

    const skip = job.data.skip;
    const limit = job.data.limit;

    let promise: Promise<GetListingsResponse>;

    if (job.name === JobType.Active) {
      promise = this.currentListingsService.fetchActiveListings(
        token,
        skip,
        limit,
      );
    } else if (job.name === JobType.Archived) {
      promise = this.currentListingsService.fetchArchivedListings(
        token,
        skip,
        limit,
      );
    } else {
      return;
    }

    let debugStr = 'Getting ' + job.name + ' listings for ' + token.steamid64;

    if (skip && limit) {
      debugStr += ' using skip ' + skip + ' and limit ' + limit;
    } else if (skip) {
      debugStr += ' using skip ' + skip;
    } else if (limit) {
      debugStr += ' using limit ' + limit;
    }

    debugStr += '...';

    this.logger.debug(debugStr);

    const response = await promise;

    this.logger.debug(
      'Got response for ' +
        job.name +
        ' listings for ' +
        token.steamid64 +
        ' (skip: ' +
        response.cursor.skip +
        ', limit: ' +
        response.cursor.limit +
        ', total: ' +
        response.cursor.total +
        ', results: ' +
        response.results.length +
        ')',
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

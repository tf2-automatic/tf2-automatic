import { OnWorkerEvent, Processor } from '@nestjs/bullmq';
import { ClsService } from 'nestjs-cls';
import { AccountWorkerHost } from '../../common/account-worker-host';
import { bullWorkerSettings } from '@tf2-automatic/queue';
import { Logger } from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import SteamID from 'steamid';
import { TokensService } from '../../tokens/tokens.service';
import { AxiosError } from 'axios';
import {
  JobData,
  JobName,
  JobResult,
  JobType,
} from '../interfaces/manage-listings-queue.interface';
import { AgentsService } from '../../agents/agents.service';
import { ManageListingsService } from '../manage-listings.service';
import { RateLimitsService } from '../../rate-limits/rate-limits.service';

type CustomJob = Job<JobData, JobResult, JobName>;

@Processor('manage-listings', {
  settings: bullWorkerSettings,
  concurrency: 4,
})
export class ManageListingsProcessor extends AccountWorkerHost<
  CustomJob,
  Worker<JobData, JobResult, JobName>
> {
  private readonly logger = new Logger(ManageListingsProcessor.name);

  private readonly createBatchSize = 100;
  private readonly deleteBatchSize = 100;
  private readonly deleteArchivedBatchSize = 100;

  constructor(
    private readonly manageListingsService: ManageListingsService,
    private readonly tokensService: TokensService,
    private readonly agentsService: AgentsService,
    private readonly rateLimitsService: RateLimitsService,
    cls: ClsService,
  ) {
    super(cls);
  }

  async processJob(job: CustomJob, lockToken?: string): Promise<JobResult> {
    // Work queued from here on is picked up by a re-run, see onCompleted
    await this.manageListingsService.clearPending(
      new SteamID(job.data.steamid64),
      job.name,
    );

    switch (job.name) {
      case JobType.Create:
        return this.handleCreateAction(job, lockToken);
      case JobType.Update:
        return this.handleUpdateAction(job, lockToken);
      case JobType.Delete:
        return this.handleDeleteAction(job, lockToken);
      case JobType.DeleteArchived:
        return this.handleDeleteArchivedAction(job, lockToken);
      case JobType.DeleteAll:
        return this.handleDeleteAllAction(job, lockToken);
      case JobType.Plan:
        return this.handlePlanAction(job);
      default:
        this.logger.error('Unknown task type: ' + job.name);
        return false;
    }
  }

  private async handleCreateAction(
    job: CustomJob,
    lockToken?: string,
  ): Promise<JobResult> {
    const steamid = new SteamID(job.data.steamid64);

    const agent = await this.agentsService.getAgent(steamid);
    if (!agent) {
      // Agent is not running, don't create listings
      return false;
    }

    const hashes = await this.manageListingsService.getListingsToCreate(
      steamid,
      this.createBatchSize,
    );

    if (hashes.length === 0) {
      return false;
    }

    const token = await this.tokensService.getToken(steamid);

    const key = steamid.getSteamID64();

    return this.rateLimitsService.scheduleOrDelay(
      job,
      lockToken,
      'listingsBatch',
      key,
      async () => {
        // Create listings
        await this.manageListingsService
          .createListings(token, hashes)
          .catch((err) => {
            return this.rateLimitsService.handleError(
              'listingsBatch',
              key,
              err,
            );
          });

        return hashes.length === this.createBatchSize;
      },
    );
  }

  async handleUpdateAction(
    job: CustomJob,
    lockToken?: string,
  ): Promise<JobResult> {
    const steamid = new SteamID(job.data.steamid64);

    const agent = await this.agentsService.getAgent(steamid);
    if (!agent) {
      // Agent is not running, don't create listings
      return false;
    }

    const hashes = await this.manageListingsService.getListingsToUpdate(
      steamid,
      this.createBatchSize,
    );

    if (hashes.length === 0) {
      return false;
    }

    const token = await this.tokensService.getToken(steamid);

    const key = steamid.getSteamID64();

    return this.rateLimitsService.scheduleOrDelay(
      job,
      lockToken,
      'listingsBatch',
      key,
      async () => {
        // Create listings
        await this.manageListingsService
          .updateListings(token, hashes)
          .catch((err) => {
            return this.rateLimitsService.handleError(
              'listingsBatch',
              key,
              err,
            );
          });

        return hashes.length === this.createBatchSize;
      },
    );
  }

  async handleDeleteAction(
    job: CustomJob,
    lockToken?: string,
  ): Promise<JobResult> {
    const steamid = new SteamID(job.data.steamid64);

    const ids = await this.manageListingsService.getListingsToDelete(
      steamid,
      this.deleteBatchSize,
    );

    if (ids.length === 0) {
      return false;
    }

    const token = await this.tokensService.getToken(steamid);

    const key = steamid.getSteamID64();

    return this.rateLimitsService.scheduleOrDelay(
      job,
      lockToken,
      'listingsBatch',
      key,
      async () => {
        await this.manageListingsService
          .deleteListings(token, ids)
          .catch((err) => {
            return this.rateLimitsService.handleError(
              'listingsBatch',
              key,
              err,
            );
          });

        return ids.length === this.deleteBatchSize;
      },
    );
  }

  async handleDeleteArchivedAction(
    job: CustomJob,
    lockToken?: string,
  ): Promise<JobResult> {
    const steamid = new SteamID(job.data.steamid64);

    const ids = await this.manageListingsService.getArchivedListingToDelete(
      steamid,
      this.deleteArchivedBatchSize,
    );

    if (ids.length === 0) {
      return false;
    }

    const token = await this.tokensService.getToken(steamid);

    const key = steamid.getSteamID64();

    return this.rateLimitsService.scheduleOrDelay(
      job,
      lockToken,
      'archiveBatch',
      key,
      async () => {
        await this.manageListingsService
          .deleteArchivedListings(token, ids)
          .catch((err) => {
            return this.rateLimitsService.handleError('archiveBatch', key, err);
          });

        return ids.length === this.deleteArchivedBatchSize;
      },
    );
  }

  async handleDeleteAllAction(
    job: CustomJob,
    lockToken?: string,
  ): Promise<JobResult> {
    const steamid = new SteamID(job.data.steamid64);

    if (await this.agentsService.getAgent(steamid)) {
      this.logger.debug(
        'Skipping deleting all listings because the agent is registered again',
      );
      return false;
    }

    const token = await this.tokensService.getToken(steamid);

    return this.rateLimitsService.scheduleOrDelay(
      job,
      lockToken,
      'deleteAll',
      steamid.getSteamID64(),
      async () => {
        // The job may have waited, check again
        if (await this.agentsService.getAgent(steamid)) {
          this.logger.debug(
            'Skipping deleting all listings because the agent is registered again',
          );
          return false;
        }

        await this.manageListingsService.deleteAllListings(token);

        return false;
      },
    );
  }

  async handlePlanAction(job: CustomJob): Promise<JobResult> {
    const steamid = new SteamID(job.data.steamid64);

    await this.manageListingsService.planListings(steamid);

    return false;
  }

  @OnWorkerEvent('error')
  onError(err: Error): void {
    this.logger.error('Error in worker');
    console.error(err);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error): void {
    this.logger.warn(`Failed to ${job.name} listings: ${err.message}`);

    if (err instanceof AxiosError) {
      console.error(err.response?.data);
    } else {
      console.error(err);
    }
  }

  @OnWorkerEvent('completed')
  async onCompleted(job: CustomJob): Promise<void> {
    const steamid = new SteamID(job.data.steamid64);

    try {
      // Re-run when the batch was full or a job was requested while running
      if (
        job.returnvalue === true ||
        (await this.manageListingsService.isPending(steamid, job.name))
      ) {
        await this.manageListingsService.createJob(steamid, job.name);
      }
    } catch (err) {
      this.logger.error('Failed to create job');
      console.error(err);
    }
  }
}

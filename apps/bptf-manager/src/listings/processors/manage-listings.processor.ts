import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnModuleDestroy } from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import SteamID from 'steamid';
import { TokensService } from '../../tokens/tokens.service';
import { AxiosError } from 'axios';
import Bottleneck from 'bottleneck';
import { ConfigService } from '@nestjs/config';
import { Config, RedisConfig } from '../../common/config/configuration';
import {
  JobData,
  JobName,
  JobResult,
  JobType,
} from '../interfaces/manage-listings-queue.interface';
import { AgentsService } from '../../agents/agents.service';
import { ManageListingsService } from '../manage-listings.service';

type CustomJob = Job<JobData, JobResult, JobName>;

@Processor('manage-listings', {
  // For some reason even though there are jobs in the queue it takes 5 seconds for them to be processed, this is a workaround
  drainDelay: 0,
})
export class ManageListingsProcessor
  extends WorkerHost<Worker<JobData, JobResult, JobName>>
  implements OnModuleDestroy
{
  private readonly logger = new Logger(ManageListingsProcessor.name);
  private readonly batchGroup: Bottleneck.Group;
  private readonly deleteAllGroup: Bottleneck.Group;

  private readonly createBatchSize = 100;
  private readonly deleteBatchSize = 100;
  private readonly deleteArchivedBatchSize = 100;

  constructor(
    private readonly manageListingsService: ManageListingsService,
    private readonly tokensService: TokensService,
    private readonly configService: ConfigService<Config>,
    private readonly agentsService: AgentsService,
  ) {
    super();

    const redisConfig = this.configService.getOrThrow<RedisConfig>('redis');

    this.batchGroup = new Bottleneck.Group({
      datastore: 'ioredis',
      clientOptions: {
        host: redisConfig.host,
        port: redisConfig.port,
        password: redisConfig.password,
        db: redisConfig.db,
        keyPrefix: 'tf2-automatic:bptf-manager:bottleneck:',
      },
      id: 'listings:batch',
      // Concurrency has to be one because we don't want to be able to create and delete listings at the same time.
      maxConcurrent: 1,
      minTime: 1000,
      reservoir: 10,
      reservoirRefreshAmount: 10,
      reservoirRefreshInterval: 60 * 1000,
    });

    this.createGroupListeners(this.batchGroup);

    this.deleteAllGroup = new Bottleneck.Group({
      datastore: 'ioredis',
      clientOptions: {
        host: redisConfig.host,
        port: redisConfig.port,
        password: redisConfig.password,
        db: redisConfig.db,
        keyPrefix: 'tf2-automatic:bptf-manager:bottleneck:',
      },
      id: 'listings:deleteAll',
      maxConcurrent: 1,
      minTime: 60000,
    });

    this.createGroupListeners(this.deleteAllGroup);
  }

  private createGroupListeners(group: Bottleneck.Group): void {
    group.on('created', (limiter, key) => {
      this.logger.debug(
        'Created limiter for ' + key + ' for group ' + group.id,
      );

      limiter.on('error', (err) => {
        if (err.message === 'ERR SETTINGS_KEY_NOT_FOUND') {
          this.logger.debug(
            'Limiter key ' +
              key +
              ' for group ' +
              group.id +
              ' disappeared, deleting...',
          );
          group
            .deleteKey(key)
            .then(() => {
              this.logger.debug(
                'Deleted limiter key ' + key + ' from group ' + group.id,
              );
              limiter.removeAllListeners();
            })
            .catch((err) => {
              this.logger.warn(
                'Failed to delete limiter key ' +
                  key +
                  ' from group ' +
                  group.id,
              );
              console.error(err);
            });

          return;
        }

        this.logger.warn('Limiter error for ' + key + ' for group ' + group.id);
        console.error(err);
      });
    });
  }

  async process(job: CustomJob): Promise<JobResult> {
    this.logger.debug(`Processing job ${job.id}...`);

    switch (job.name) {
      case JobType.Create:
        return this.handleCreateAction(job);
      case JobType.Update:
        return this.handleUpdateAction(job);
      case JobType.Delete:
        return this.handleDeleteAction(job);
      case JobType.DeleteArchived:
        return this.handleDeleteArchivedAction(job);
      case JobType.DeleteAll:
        return this.handleDeleteAllAction(job);
      case JobType.Plan:
        return this.handlePlanAction(job);
      default:
        this.logger.warn('Unknown task type: ' + job.name);
        return false;
    }
  }

  private async handleCreateAction(job: CustomJob): Promise<JobResult> {
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

    this.logger.debug(
      'Scheduling create listings for ' + steamid.getSteamID64() + '...',
    );

    const key = steamid.getSteamID64() + ':create';

    return this.batchGroup.key(key).schedule(async () => {
      // Create listings
      await this.manageListingsService
        .createListings(token, hashes)
        .catch((err) => {
          if (err instanceof AxiosError) {
            if (err.response?.status === 429) {
              // We are rate limited, find the correct reservoir
              const limiters = this.batchGroup.limiters();
              const match = limiters.find((l) => l.key === key);

              if (match) {
                // Drain the reservoir
                return match.limiter.incrementReservoir(-10).then(() => {
                  throw err;
                });
              }
            }
          }

          throw err;
        });

      return hashes.length === this.createBatchSize;
    });
  }

  async handleUpdateAction(job: CustomJob): Promise<JobResult> {
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

    this.logger.debug(
      'Scheduling update listings for ' + steamid.getSteamID64() + '...',
    );

    const key = steamid.getSteamID64() + ':update';

    return this.batchGroup.key(key).schedule(async () => {
      // Create listings
      await this.manageListingsService
        .updateListings(token, hashes)
        .catch((err) => {
          if (err instanceof AxiosError) {
            if (err.response?.status === 429) {
              // We are rate limited, find the correct reservoir
              const limiters = this.batchGroup.limiters();
              const match = limiters.find((l) => l.key === key);

              if (match) {
                // Drain the reservoir
                return match.limiter.incrementReservoir(-10).then(() => {
                  throw err;
                });
              }
            }
          }

          throw err;
        });

      return hashes.length === this.createBatchSize;
    });
  }

  async handleDeleteAction(job: CustomJob): Promise<JobResult> {
    const steamid = new SteamID(job.data.steamid64);

    const ids = await this.manageListingsService.getListingsToDelete(
      steamid,
      this.deleteBatchSize,
    );

    if (ids.length === 0) {
      return false;
    }

    const token = await this.tokensService.getToken(steamid);

    await this.manageListingsService.deleteListings(token, ids);

    return ids.length === this.deleteBatchSize;
  }

  async handleDeleteArchivedAction(job: CustomJob): Promise<JobResult> {
    const steamid = new SteamID(job.data.steamid64);

    const ids = await this.manageListingsService.getArchivedListingToDelete(
      steamid,
      this.deleteArchivedBatchSize,
    );

    if (ids.length === 0) {
      return false;
    }

    this.logger.debug(
      'Scheduling create listings for ' + steamid.getSteamID64() + '...',
    );

    const token = await this.tokensService.getToken(steamid);

    return this.batchGroup
      .key(steamid.getSteamID64() + ':create')
      .schedule(async () => {
        await this.manageListingsService.deleteArchivedListings(token, ids);

        return ids.length === this.deleteArchivedBatchSize;
      });
  }

  async handleDeleteAllAction(job: CustomJob): Promise<JobResult> {
    const steamid = new SteamID(job.data.steamid64);

    const token = await this.tokensService.getToken(steamid);

    this.logger.debug(
      'Scheduling to delete all listings for ' + steamid.getSteamID64() + '...',
    );

    return this.deleteAllGroup
      .key(steamid.getSteamID64())
      .schedule(async () => {
        await this.manageListingsService.deleteAllListings(token);

        return false;
      });
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
    this.logger.warn(
      `Failed to ${job.name} listings for ${job.data.steamid64}: ${err.message}`,
    );

    if (err instanceof AxiosError) {
      console.error('Status code ' + err.response?.status);
      console.error(err.response?.data);
    } else {
      console.error(err);
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: CustomJob): void {
    const steamid = new SteamID(job.data.steamid64);

    this.logger.debug('Completed job ' + job.id);

    if (job.returnvalue === true) {
      this.manageListingsService.createJob(steamid, job.name).catch((err) => {
        this.logger.error('Failed to create job');
        console.error(err);
      });
    }
  }

  onModuleDestroy() {
    return Promise.allSettled([
      this.batchGroup.disconnect(true),
      this.deleteAllGroup.disconnect(true),
    ]);
  }
}

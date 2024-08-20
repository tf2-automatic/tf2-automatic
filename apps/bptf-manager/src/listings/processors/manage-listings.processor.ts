import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import SteamID from 'steamid';
import { TokensService } from '../../tokens/tokens.service';
import { AxiosError } from 'axios';
import Bottleneck from 'bottleneck';
import { ConfigService } from '@nestjs/config';
import { Config } from '../../common/config/configuration';
import {
  JobData,
  JobName,
  JobResult,
  JobType,
} from '../interfaces/manage-listings-queue.interface';
import { AgentsService } from '../../agents/agents.service';
import { ManageListingsService } from '../manage-listings.service';
import { Redis } from '@tf2-automatic/config';
import { InjectRedis } from '@songkeys/nestjs-redis';
import IORedis from 'ioredis';
import fs from 'fs';
import path from 'path';

type CustomJob = Job<JobData, JobResult, JobName>;

@Processor('manage-listings', {
  concurrency: 4,
})
export class ManageListingsProcessor
  extends WorkerHost<Worker<JobData, JobResult, JobName>>
  implements OnModuleDestroy, OnModuleInit
{
  private readonly logger = new Logger(ManageListingsProcessor.name);
  private batchGroup: Bottleneck.Group;
  private deleteAllGroup: Bottleneck.Group;

  private readonly createBatchSize = 100;
  private readonly deleteBatchSize = 100;
  private readonly deleteArchivedBatchSize = 100;

  constructor(
    private readonly manageListingsService: ManageListingsService,
    private readonly tokensService: TokensService,
    private readonly configService: ConfigService<Config>,
    private readonly agentsService: AgentsService,
    @InjectRedis()
    private readonly redis: IORedis,
  ) {
    super();

    this.createBottlenecks(true);
  }

  private createBottlenecks(clearDatastore = false): void {
    const redisConfig = this.configService.getOrThrow<Redis.Config>('redis');

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
      maxConcurrent: 1,
      minTime: 6000,
      reservoir: 10,
      reservoirIncreaseAmount: 10,
      reservoirIncreaseInterval: 60000,
      reservoirIncreaseMaximum: 10,
      clearDatastore,
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
      clearDatastore,
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

  private async disconnectBottlenecks(): Promise<void> {
    await Promise.all([
      this.batchGroup.disconnect(true),
      this.deleteAllGroup.disconnect(true),
    ]);
  }

  async onModuleInit(): Promise<void> {
    // Compare current version with old version
    const oldVersion = await this.redis.get(
      'tf2-automatic:bptf-manager:version',
    );

    const packageJson = fs.readFileSync(
      path.join(__dirname, 'package.json'),
      'utf-8',
    );

    const currentVersion = JSON.parse(packageJson).version;
    if (oldVersion === currentVersion) {
      return;
    }

    this.logger.warn(
      `Running a different version, current: ${currentVersion} previous: ${oldVersion}. Updating limiters...`,
    );

    this.batchGroup.updateSettings({
      clearDatastore: true,
    });

    this.deleteAllGroup.updateSettings({
      clearDatastore: true,
    });

    await this.disconnectBottlenecks();

    this.createBottlenecks(true);

    await this.redis.set('tf2-automatic:bptf-manager:version', currentVersion);
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
          return this.handleBatchError(key, err);
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
          return this.handleBatchError(key, err);
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
      'Scheduling delete archived listings for ' +
        steamid.getSteamID64() +
        '...',
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

  private async handleBatchError(
    key: string,
    err: Error | AxiosError,
  ): Promise<void> {
    if (!(err instanceof AxiosError)) {
      throw err;
    }

    if (err.response?.status !== 429) {
      throw err;
    }

    // We are rate limited, find the correct reservoir
    const limiters = this.batchGroup.limiters();
    const match = limiters.find((l) => l.key === key);

    if (!match) {
      // Shouldn't happen
      throw err;
    }

    const waitTime = new String(err.response.data.message).match(
      /Try again in (\d+) seconds./,
    );

    // Decrement by 10 by default
    let decrementAmount = 10;

    if (waitTime) {
      const tryAgainTime = parseInt(waitTime[1]);
      // Decrement by 1 for every 6 seconds we need to wait
      decrementAmount = Math.min(Math.ceil(tryAgainTime / 6), 10);
    }

    const current = await match.limiter.currentReservoir();

    // Subtract `decrementAmount` because this is how many requests we need to wait for
    // Subtract `current` because the reservoir needs to be emptied
    const increment = -decrementAmount - (current ?? 0);

    // No reason to think about parallel requests because it is limited to one at a time
    return match.limiter.incrementReservoir(increment).then(() => {
      throw err;
    });
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
    return this.disconnectBottlenecks();
  }
}

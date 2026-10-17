import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { bullWorkerSettings } from '@tf2-automatic/queue';
import { Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DelayedError, Job, Worker } from 'bullmq';
import SteamID from 'steamid';
import { TokensService } from '../../tokens/tokens.service';
import { AxiosError } from 'axios';
import Bottleneck from 'bottleneck';
import { ConfigService } from '@nestjs/config';
import {
  BatchOperation,
  Config,
  ListingsConfig,
  RateLimitConfig,
} from '../../common/config/configuration';
import {
  JobData,
  JobName,
  JobResult,
  JobType,
} from '../interfaces/manage-listings-queue.interface';
import { AgentsService } from '../../agents/agents.service';
import { ManageListingsService } from '../manage-listings.service';
import { Redis as RedisConfig } from '@tf2-automatic/config';
import { RedisService } from '@liaoliaots/nestjs-redis';
import Redis from 'ioredis';
import hash from 'object-hash';

type CustomJob = Job<JobData, JobResult, JobName>;

const BATCH_OPERATIONS: BatchOperation[] = [
  'create',
  'update',
  'delete',
  'deleteArchived',
];

// Changing these clears the limiter state on the next start
function getBatchLimiter(
  operation: BatchOperation,
  { requests, window }: RateLimitConfig,
): Bottleneck.ConstructorOptions {
  return {
    id: 'listings:' + operation,
    maxConcurrent: 1,
    minTime: Math.ceil(window / requests),
    reservoir: requests,
    reservoirIncreaseAmount: requests,
    reservoirIncreaseInterval: window,
    reservoirIncreaseMaximum: requests,
  };
}

const DELETE_ALL_LIMITER: Bottleneck.ConstructorOptions = {
  id: 'listings:deleteAll',
  maxConcurrent: 1,
  minTime: 60000,
};

@Processor('manage-listings', {
  settings: bullWorkerSettings,
  concurrency: 4,
})
export class ManageListingsProcessor
  extends WorkerHost<Worker<JobData, JobResult, JobName>>
  implements OnModuleDestroy, OnModuleInit
{
  private readonly logger = new Logger(ManageListingsProcessor.name);
  private batchGroups: Record<BatchOperation, Bottleneck.Group>;
  private deleteAllGroup: Bottleneck.Group;

  private readonly createBatchSize = 100;
  private readonly deleteBatchSize = 100;
  private readonly deleteArchivedBatchSize = 100;

  private readonly redis: Redis = this.redisService.getOrThrow();

  private readonly rateLimits: Record<BatchOperation, RateLimitConfig>;
  private readonly batchLimiters: Record<
    BatchOperation,
    Bottleneck.ConstructorOptions
  >;

  constructor(
    private readonly manageListingsService: ManageListingsService,
    private readonly tokensService: TokensService,
    private readonly configService: ConfigService<Config>,
    private readonly agentsService: AgentsService,
    private readonly redisService: RedisService,
  ) {
    super();

    this.rateLimits =
      this.configService.getOrThrow<ListingsConfig>('listings').rateLimits;

    this.batchLimiters = Object.fromEntries(
      BATCH_OPERATIONS.map((operation) => [
        operation,
        getBatchLimiter(operation, this.rateLimits[operation]),
      ]),
    ) as Record<BatchOperation, Bottleneck.ConstructorOptions>;

    this.createBottlenecks();
  }

  private createBottlenecks(clearDatastore = false): void {
    const redisConfig =
      this.configService.getOrThrow<RedisConfig.Config>('redis');

    this.batchGroups = Object.fromEntries(
      BATCH_OPERATIONS.map((operation) => {
        const group = new Bottleneck.Group({
          datastore: 'ioredis',
          clientOptions: {
            ...redisConfig,
            keyPrefix: redisConfig.keyPrefix + 'bottleneck:',
          },
          ...this.batchLimiters[operation],
          clearDatastore,
        });

        this.createGroupListeners(group);

        return [operation, group];
      }),
    ) as Record<BatchOperation, Bottleneck.Group>;

    this.deleteAllGroup = new Bottleneck.Group({
      datastore: 'ioredis',
      clientOptions: {
        ...redisConfig,
        keyPrefix: redisConfig.keyPrefix + 'bottleneck:',
      },
      ...DELETE_ALL_LIMITER,
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
      ...Object.values(this.batchGroups).map((group) => group.disconnect(true)),
      this.deleteAllGroup.disconnect(true),
    ]);
  }

  async onModuleInit(): Promise<void> {
    // Redis keeps the old limiter settings unless the datastore is cleared
    const settingsHash = hash([this.batchLimiters, DELETE_ALL_LIMITER]);
    if ((await this.redis.get('limiters:hash')) === settingsHash) {
      return;
    }

    this.logger.warn('Limiter settings changed, clearing limiters...');

    await this.disconnectBottlenecks();

    this.createBottlenecks(true);

    await this.redis.set('limiters:hash', settingsHash);
  }

  async process(job: CustomJob, lockToken?: string): Promise<JobResult> {
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
        this.logger.warn('Unknown task type: ' + job.name);
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

    return this.scheduleOrDelay(
      job,
      lockToken,
      this.batchGroups.create,
      key,
      this.batchLimiters.create,
      async () => {
        // Create listings
        await this.manageListingsService
          .createListings(token, hashes)
          .catch((err) => {
            return this.handleBatchError('create', key, err);
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

    return this.scheduleOrDelay(
      job,
      lockToken,
      this.batchGroups.update,
      key,
      this.batchLimiters.update,
      async () => {
        // Create listings
        await this.manageListingsService
          .updateListings(token, hashes)
          .catch((err) => {
            return this.handleBatchError('update', key, err);
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

    return this.scheduleOrDelay(
      job,
      lockToken,
      this.batchGroups.delete,
      key,
      this.batchLimiters.delete,
      async () => {
        await this.manageListingsService
          .deleteListings(token, ids)
          .catch((err) => {
            return this.handleBatchError('delete', key, err);
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

    return this.scheduleOrDelay(
      job,
      lockToken,
      this.batchGroups.deleteArchived,
      key,
      this.batchLimiters.deleteArchived,
      async () => {
        await this.manageListingsService
          .deleteArchivedListings(token, ids)
          .catch((err) => {
            return this.handleBatchError('deleteArchived', key, err);
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

    const token = await this.tokensService.getToken(steamid);

    return this.scheduleOrDelay(
      job,
      lockToken,
      this.deleteAllGroup,
      steamid.getSteamID64(),
      DELETE_ALL_LIMITER,
      async () => {
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

  // Delay the job instead of holding a worker slot while the limiter is busy
  private async scheduleOrDelay(
    job: CustomJob,
    lockToken: string | undefined,
    group: Bottleneck.Group,
    key: string,
    options: Bottleneck.ConstructorOptions,
    task: () => Promise<JobResult>,
  ): Promise<JobResult> {
    const limiter = group.key(key);

    // Wait out a known rate limit window in one go instead of polling
    let delay = await this.redis.pttl(this.getRateLimitedKey(group, key));
    if (delay <= 0 && !(await limiter.check())) {
      delay = Math.max(options.minTime ?? 0, 1000);
    }

    if (delay > 0) {
      this.logger.debug(
        `Rate limited ${job.name} for ${job.data.steamid64}, delaying ${Math.ceil(delay / 1000)}s...`,
      );
      await job.moveToDelayed(Date.now() + delay, lockToken);
      throw new DelayedError();
    }

    this.logger.debug(`Scheduling ${job.name} for ${job.data.steamid64}...`);

    return limiter.schedule(task);
  }

  private getRateLimitedKey(group: Bottleneck.Group, key: string): string {
    return `ratelimited:${group.id}:${key}`;
  }

  private async handleBatchError(
    operation: BatchOperation,
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
    const group = this.batchGroups[operation];
    const limiters = group.limiters();
    const match = limiters.find((l) => l.key === key);

    if (!match) {
      // Shouldn't happen
      throw err;
    }

    const { maxWindowRequests, windowSeconds } = err.response.data ?? {};
    if (
      typeof maxWindowRequests === 'number' &&
      typeof windowSeconds === 'number'
    ) {
      // Wait for the window and follow the limit backpack.tf told us about
      await match.limiter.updateSettings({
        reservoir: 0,
        reservoirIncreaseAmount: maxWindowRequests,
        reservoirIncreaseMaximum: maxWindowRequests,
        reservoirIncreaseInterval: windowSeconds * 1000,
      });
      await this.redis.set(
        this.getRateLimitedKey(group, key),
        1,
        'PX',
        windowSeconds * 1000,
      );
      throw err;
    }

    const waitTime = new String(err.response.data.message).match(
      /Try again in (\d+) seconds./,
    );

    const { requests, window } = this.rateLimits[operation];

    // Wait a full window by default
    let decrementAmount = requests;

    if (waitTime) {
      const tryAgainTime = parseInt(waitTime[1]);
      // Decrement by 1 for every request interval we need to wait
      decrementAmount = Math.min(
        Math.ceil((tryAgainTime * 1000 * requests) / window),
        requests,
      );

      await this.redis.set(
        this.getRateLimitedKey(group, key),
        1,
        'PX',
        tryAgainTime * 1000,
      );
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

  onModuleDestroy() {
    return this.disconnectBottlenecks();
  }
}

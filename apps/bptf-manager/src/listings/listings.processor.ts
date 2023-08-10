import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnModuleDestroy } from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import { ListingsService } from './listings.service';
import SteamID from 'steamid';
import { TokensService } from '../tokens/tokens.service';
import { AxiosError } from 'axios';
import Bottleneck from 'bottleneck';
import { ConfigService } from '@nestjs/config';
import { Config, RedisConfig } from '../common/config/configuration';
import {
  JobData,
  JobName,
  JobResult,
  JobType,
} from './interfaces/queue.interface';
import { AgentsService } from '../agents/agents.service';

type CustomJob = Job<JobData, JobResult, JobName>;

@Processor('listings')
export class ListingsProcessor
  extends WorkerHost<Worker<JobData, JobResult, JobName>>
  implements OnModuleDestroy
{
  private readonly logger = new Logger(ListingsProcessor.name);
  private readonly batchGroup: Bottleneck.Group;
  private readonly deleteAllGroup: Bottleneck.Group;

  private readonly createBatchSize = 50;
  private readonly deleteBatchSize = 100;
  private readonly deleteArchivedBatchSize = 100;

  constructor(
    private readonly listingsService: ListingsService,
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
      case JobType.Delete:
        return this.handleDeleteAction(job);
      case JobType.DeleteArchived:
        return this.handleDeleteArchivedAction(job);
      case JobType.DeleteAll:
        return this.handleDeleteAllAction(job);
      case JobType.DeleteAllArchived:
        return this.handleDeleteAllArchivedAction(job);
      default:
        this.logger.warn('Unknown task type: ' + job.name);
        return {
          more: false,
          amount: 0,
          done: false,
        };
    }
  }

  private async handleCreateAction(job: CustomJob): Promise<JobResult> {
    const steamid = new SteamID(job.data.steamid64);

    const registering = await this.agentsService.isRegistering(steamid);
    if (!registering) {
      // Agent is not running, don't create listings
      return {
        more: false,
        amount: 0,
        done: false,
      };
    }

    const hashes = await this.listingsService.getHashesToCreate(
      steamid,
      this.createBatchSize,
    );

    if (hashes.length === 0) {
      return {
        more: false,
        amount: 0,
        done: false,
      };
    }

    this.logger.debug(
      'Scheduling create listings for ' + steamid.getSteamID64() + '...',
    );

    const token = await this.tokensService.getToken(steamid);

    return this.batchGroup.key(steamid.getSteamID64()).schedule(async () => {
      // Get listings with highest priority
      const desired = await this.listingsService.getDesired(steamid, hashes);

      const create = Object.values(desired).map((d) => d.listing);

      this.logger.log(
        'Creating ' +
          create.length +
          ' listing(s) for ' +
          steamid.getSteamID64() +
          '...',
      );

      // Create listings
      const result = await this.listingsService
        .createListings(token, create)
        .catch((err) => {
          if (err instanceof AxiosError) {
            if (err.response?.status === 429) {
              // We are rate limited, find the correct reservoir
              const limiters = this.batchGroup.limiters();
              const match = limiters.find((l) => l.key === steamid.toString());

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

      let created = 0;
      result.forEach((e) => {
        if (e.result !== undefined) {
          created++;
        }
      });

      // Save listings
      await this.listingsService.handleCreatedListings(steamid, hashes, result);

      return {
        more: hashes.length === this.createBatchSize,
        amount: created,
        done: true,
      };
    });
  }

  async handleDeleteAction(job: CustomJob): Promise<JobResult> {
    const steamid = new SteamID(job.data.steamid64);

    const ids = await this.listingsService.getListingIdsToDelete(
      steamid,
      this.deleteBatchSize,
    );

    if (ids.length === 0) {
      return {
        more: false,
        amount: 0,
        done: false,
      };
    }

    this.logger.log(
      'Deleting ' +
        ids.length +
        ' listing(s) for ' +
        steamid.getSteamID64() +
        '...',
    );

    const token = await this.tokensService.getToken(steamid);

    const result = await this.listingsService.deleteListings(token, ids);

    await this.listingsService.handleDeletedListings(steamid, ids);

    return {
      more: ids.length === this.deleteBatchSize,
      amount: result.deleted,
      done: true,
    };
  }

  async handleDeleteArchivedAction(job: CustomJob): Promise<JobResult> {
    const steamid = new SteamID(job.data.steamid64);

    const ids = await this.listingsService.getArchivedListingIdsToDelete(
      steamid,
      this.deleteArchivedBatchSize,
    );

    if (ids.length === 0) {
      return {
        more: false,
        amount: 0,
        done: false,
      };
    }

    this.logger.debug(
      'Scheduling create listings for ' + steamid.getSteamID64() + '...',
    );

    const token = await this.tokensService.getToken(steamid);

    return this.batchGroup.key(steamid.getSteamID64()).schedule(async () => {
      this.logger.log(
        'Deleting ' +
          ids.length +
          ' archived listing(s) for ' +
          steamid.getSteamID64() +
          '...',
      );

      const result = await this.listingsService.deleteArchivedListings(
        token,
        ids,
      );

      await this.listingsService.handleDeletedArchivedListings(steamid, ids);

      return {
        more: ids.length === this.deleteArchivedBatchSize,
        amount: result.deleted,
        done: true,
      };
    });
  }

  async handleDeleteAllAction(job: CustomJob): Promise<JobResult> {
    const steamid = new SteamID(job.data.steamid64);

    const token = await this.tokensService.getToken(steamid);

    this.logger.debug(
      'Scheduling to delete all listings for ' + steamid.getSteamID64() + '...',
    );

    return this.deleteAllGroup
      .key(steamid.getSteamID64() + ':listings')
      .schedule(async () => {
        this.logger.log(
          'Deleting all listings for ' + steamid.getSteamID64() + '...',
        );

        const result = await this.listingsService.deleteAllListings(token);

        await this.listingsService.handleDeletedAllListings(steamid);

        return {
          more: false,
          amount: result.deleted,
          done: true,
        };
      });
  }

  async handleDeleteAllArchivedAction(job: CustomJob): Promise<JobResult> {
    const steamid = new SteamID(job.data.steamid64);

    const token = await this.tokensService.getToken(steamid);

    this.logger.debug(
      'Scheduling to delete all archived listings for ' +
        steamid.getSteamID64() +
        '...',
    );

    return this.deleteAllGroup
      .key(steamid.getSteamID64() + ':archive')
      .schedule(async () => {
        this.logger.log(
          'Deleting all archived listings for ' +
            steamid.getSteamID64() +
            '...',
        );

        const result = await this.listingsService.deleteAllArchivedListings(
          token,
        );

        await this.listingsService.handleDeletedAllArchivedListings(steamid);

        return {
          more: false,
          amount: result.deleted,
          done: true,
        };
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
      `Failed to ${job.name} listings for ${job.data.steamid64}`,
    );

    if (err instanceof AxiosError) {
      console.error('Status code ' + err.response?.status);
      console.error(err.response?.data);
    } else {
      console.error(err);
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<JobData, JobResult, JobName>): void {
    const steamid = new SteamID(job.data.steamid64);

    this.logger.debug('Completed job ' + job.id);

    if (job.returnvalue.done) {
      switch (job.name) {
        case JobType.Create:
          this.logger.log(
            `Created ${
              job.returnvalue.amount
            } listing(s) for ${steamid.getSteamID64()}`,
          );
          break;
        case JobType.Delete:
        case JobType.DeleteAll:
          this.logger.log(
            `Deleted ${
              job.returnvalue.amount
            } listing(s) for ${steamid.getSteamID64()}`,
          );
          break;
        case JobType.DeleteArchived:
        case JobType.DeleteAllArchived:
          this.logger.log(
            `Deleted ${
              job.returnvalue.amount
            } archived listing(s) for ${steamid.getSteamID64()}`,
          );
          break;
      }
    }

    if (job.name === 'create' && job.returnvalue.done === true) {
      // We just created some listings and now might have to delete some

      // TODO: Only create job if it is actually needed
      this.listingsService.createJob(steamid, JobType.Delete).catch((err) => {
        this.logger.error('Failed to create job');
        console.error(err);
      });
    }

    if (job.returnvalue.more === true) {
      this.listingsService.createJob(steamid, job.name).catch((err) => {
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

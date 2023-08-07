import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnModuleDestroy } from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import { ListingsService } from './listings.service';
import SteamID from 'steamid';
import { TokensService } from '../tokens/tokens.service';
import { DesiredListing as DesiredListingInternal } from './interfaces/desired-listing.interface';
import { Listing } from '@tf2-automatic/bptf-manager-data';
import { AxiosError } from 'axios';
import Bottleneck from 'bottleneck';
import { ConfigService } from '@nestjs/config';
import { Config, RedisConfig } from '../common/config/configuration';
import { JobData, JobName, JobResult } from './interfaces/queue.interface';

@Processor('listings')
export class ListingsProcessor
  extends WorkerHost<Worker<JobData, JobResult, JobName>>
  implements OnModuleDestroy
{
  private readonly logger = new Logger(ListingsProcessor.name);
  private readonly group: Bottleneck.Group;

  private readonly createBatchSize = 50;
  private readonly deleteBatchSize = 100;
  private readonly deleteArchivedBatchSize = 100;

  constructor(
    private readonly listingsService: ListingsService,
    private readonly tokensService: TokensService,
    private readonly configService: ConfigService<Config>,
  ) {
    super();

    const redisConfig = this.configService.getOrThrow<RedisConfig>('redis');

    this.group = new Bottleneck.Group({
      datastore: 'ioredis',
      clientOptions: {
        host: redisConfig.host,
        port: redisConfig.port,
        password: redisConfig.password,
        db: redisConfig.db,
        keyPrefix: 'tf2-automatic:bptf-manager:bottleneck:',
      },
      id: 'listings',
      maxConcurrent: 1,
      minTime: 1000,
      reservoir: 10,
      reservoirRefreshAmount: 10,
      reservoirRefreshInterval: 60 * 1000,
      timeout: 60 * 1000,
    });

    this.group.on('created', (limiter, key) => {
      this.logger.debug('Created limiter for ' + key);

      limiter.on('error', (err) => {
        if (err.message === 'ERR SETTINGS_KEY_NOT_FOUND') {
          this.logger.debug('Limiter key ' + key + ' disappeared, deleting...');
          this.group
            .deleteKey(key)
            .then(() => {
              this.logger.debug('Deleted limiter key ' + key);
              limiter.removeAllListeners();
            })
            .catch((err) => {
              this.logger.warn('Failed to delete limiter key ' + key);
              console.error(err);
            });

          return;
        }

        this.logger.warn('Limiter error for ' + key);
        console.error(err);
      });
    });
  }

  async process(job: Job<JobData, JobResult, JobName>): Promise<JobResult> {
    this.logger.debug(`Processing job ${job.id}...`);

    switch (job.name) {
      case 'create':
        return this.handleCreateAction(job);
      case 'delete':
        return this.handleDeleteAction(job);
      case 'deleteArchived':
        return this.handleDeleteArchivedAction(job);
      default:
        this.logger.warn('Unknown task type: ' + job.name);
        return {
          more: false,
          amount: 0,
          done: false,
        };
    }
  }

  private async handleCreateAction(
    job: Job<JobData, JobResult, JobName>,
  ): Promise<JobResult> {
    const steamid = new SteamID(job.data.steamid64);

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

    return this.group.key(steamid.getSteamID64()).schedule(async () => {
      // Get listings with highest priority
      const desired = await this.listingsService.getDesired(steamid, hashes);

      const create = desired
        .filter((d): d is DesiredListingInternal => d !== null)
        .map((d) => d.listing);

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
              const limiters = this.group.limiters();
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

      const created: Record<string, Listing> = {};
      const updated: Record<string, Listing> = {};
      const failed: Record<string, string | null> = {};

      // Figure out which listings were created and which weren't
      result.forEach((e, i) => {
        if (e.result !== undefined) {
          if (e.result.listedAt > e.result.bumpedAt) {
            updated[hashes[i]] = e.result;
          } else {
            created[hashes[i]] = e.result;
          }
        } else {
          failed[hashes[i]] = e.error?.message ?? null;
        }
      });

      // Save listings
      await this.listingsService.handleCreatedListings(
        steamid,
        created,
        updated,
        failed,
      );

      return {
        more: hashes.length === this.createBatchSize,
        amount: Object.keys(created).length + Object.keys(updated).length,
        done: true,
      };
    });
  }

  async handleDeleteAction(job: Job): Promise<JobResult> {
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

  async handleDeleteArchivedAction(job: Job): Promise<JobResult> {
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

    return this.group.key(steamid.getSteamID64()).schedule(async () => {
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
        case 'create':
        case 'delete':
          this.logger.log(
            `${job.name.charAt(0).toUpperCase() + job.name.slice(1)}d ${
              job.returnvalue.amount
            } listing(s) for ${steamid.getSteamID64()}`,
          );
          break;
        case 'deleteArchived':
          this.logger.log(
            `Deleted ${
              job.returnvalue.amount
            } archived listing(s) for ${steamid.getSteamID64()}`,
          );
      }
    }

    if (job.name === 'create' && job.returnvalue.done === true) {
      // We just created some listings and now might have to delete some

      // TODO: Only create job if it is actually needed
      this.listingsService.createJob(steamid, 'delete').catch((err) => {
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
    return this.group.disconnect(true);
  }
}

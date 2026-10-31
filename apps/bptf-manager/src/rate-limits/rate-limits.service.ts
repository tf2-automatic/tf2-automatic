import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '@liaoliaots/nestjs-redis';
import { Redis as RedisConfig } from '@tf2-automatic/config';
import { AxiosError } from 'axios';
import Bottleneck from 'bottleneck';
import { DelayedError, Job } from 'bullmq';
import Redis from 'ioredis';
import hash from 'object-hash';
import {
  Config,
  RateLimitsConfig,
  RateLimitConfig,
  RateLimitedEndpoint,
} from '../common/config/configuration';

export type LimitedEndpoint = RateLimitedEndpoint | 'deleteAll';

const RATE_LIMITED_ENDPOINTS: RateLimitedEndpoint[] = [
  'listingsBatch',
  'archiveBatch',
  'listingsGet',
  'archiveGet',
  'notificationsGet',
];

// Changing these clears the limiter state on the next start
function getLimiterOptions(
  endpoint: RateLimitedEndpoint,
  { requests, window }: RateLimitConfig,
): Bottleneck.ConstructorOptions {
  return {
    id: endpoint,
    maxConcurrent: 1,
    // Even spacing keeps any sliding window under the limit
    minTime: Math.ceil(window / requests),
  };
}

const DELETE_ALL_LIMITER: Bottleneck.ConstructorOptions = {
  id: 'deleteAll',
  maxConcurrent: 1,
  minTime: 60000,
};

@Injectable()
export class RateLimitsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RateLimitsService.name);

  private readonly redis: Redis = this.redisService.getOrThrow();

  private readonly rateLimits: Record<RateLimitedEndpoint, RateLimitConfig>;
  private readonly options: Record<
    LimitedEndpoint,
    Bottleneck.ConstructorOptions
  >;
  private groups: Record<LimitedEndpoint, Bottleneck.Group>;

  constructor(
    private readonly configService: ConfigService<Config>,
    private readonly redisService: RedisService,
  ) {
    this.rateLimits =
      this.configService.getOrThrow<RateLimitsConfig>('rateLimits');

    this.options = {
      ...(Object.fromEntries(
        RATE_LIMITED_ENDPOINTS.map((endpoint) => [
          endpoint,
          getLimiterOptions(endpoint, this.rateLimits[endpoint]),
        ]),
      ) as Record<RateLimitedEndpoint, Bottleneck.ConstructorOptions>),
      deleteAll: DELETE_ALL_LIMITER,
    };

    this.createBottlenecks();
  }

  private createBottlenecks(clearDatastore = false): void {
    const redisConfig =
      this.configService.getOrThrow<RedisConfig.Config>('redis');

    this.groups = Object.fromEntries(
      Object.entries(this.options).map(([endpoint, options]) => {
        const group = new Bottleneck.Group({
          datastore: 'ioredis',
          clientOptions: {
            ...redisConfig,
            keyPrefix: redisConfig.keyPrefix + 'bottleneck:',
          },
          ...options,
          clearDatastore,
        });

        this.createGroupListeners(group);

        return [endpoint, group];
      }),
    ) as Record<LimitedEndpoint, Bottleneck.Group>;
  }

  private createGroupListeners(group: Bottleneck.Group): void {
    group.on('created', (limiter, key) => {
      limiter.on('error', (err) => {
        if (err.message === 'ERR SETTINGS_KEY_NOT_FOUND') {
          group
            .deleteKey(key)
            .then(() => {
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
    await Promise.all(
      Object.values(this.groups).map((group) => group.disconnect(true)),
    );
  }

  async onModuleInit(): Promise<void> {
    // Redis keeps the old limiter settings unless the datastore is cleared
    const settingsHash = hash(this.options);
    if ((await this.redis.get('limiters:hash')) === settingsHash) {
      return;
    }

    this.logger.log('Limiter settings changed, clearing limiters...');

    await this.disconnectBottlenecks();

    this.createBottlenecks(true);

    await this.redis.set('limiters:hash', settingsHash);
  }

  onModuleDestroy() {
    return this.disconnectBottlenecks();
  }

  // Delay the job instead of holding a worker slot while the limiter is busy
  async scheduleOrDelay<T>(
    job: Job<{ steamid64: string }>,
    lockToken: string | undefined,
    endpoint: LimitedEndpoint,
    key: string,
    task: () => Promise<T>,
  ): Promise<T> {
    const group = this.groups[endpoint];
    let limiter = group.key(key);
    const options = this.options[endpoint];

    // Wait out a known rate limit window in one go instead of polling
    let delay = await this.redis.pttl(this.getRateLimitedKey(endpoint, key));
    if (delay <= 0) {
      const ready = await limiter.check().catch(async (err) => {
        if (err.message !== 'ERR SETTINGS_KEY_NOT_FOUND') {
          throw err;
        }

        // Bottleneck expired the idle key in Redis, start with a new limiter
        await group.deleteKey(key);
        limiter = group.key(key);
        return limiter.check();
      });

      if (!ready) {
        // The next request is allowed at most minTime from now
        delay = Math.max(options.minTime ?? 0, 1000);
      }
    }

    if (delay > 0) {
      this.logger.debug(
        `Rate limited ${job.name}, delaying ${Math.ceil(delay / 1000)}s`,
      );
      await job.moveToDelayed(Date.now() + delay, lockToken);
      throw new DelayedError();
    }

    return limiter.schedule(task);
  }

  private getRateLimitedKey(endpoint: LimitedEndpoint, key: string): string {
    return `ratelimited:${endpoint}:${key}`;
  }

  async handleError(
    endpoint: RateLimitedEndpoint,
    key: string,
    err: Error | AxiosError,
  ): Promise<never> {
    if (!(err instanceof AxiosError)) {
      throw err;
    }

    if (err.response?.status !== 429) {
      throw err;
    }

    const { maxWindowRequests, windowSeconds, message } =
      err.response.data ?? {};

    // Wait a full window by default
    let wait = this.rateLimits[endpoint].window;

    if (
      typeof maxWindowRequests === 'number' &&
      typeof windowSeconds === 'number'
    ) {
      wait = windowSeconds * 1000;
      // Follow the limit backpack.tf told us about
      await this.groups[endpoint]
        .key(key)
        .updateSettings({ minTime: Math.ceil(wait / maxWindowRequests) });
    } else {
      const tryAgain = String(message).match(/Try again in (\d+) seconds./);
      if (tryAgain) {
        wait = parseInt(tryAgain[1]) * 1000;
      }
    }

    await this.redis.set(this.getRateLimitedKey(endpoint, key), 1, 'PX', wait);
    throw err;
  }
}

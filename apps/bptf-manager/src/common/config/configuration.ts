import {
  LockConfig,
  Redis,
  getEnvOrThrow,
  getEnvWithDefault,
  getLockConfig,
} from '@tf2-automatic/config';

export interface Config {
  port: number;
  keepAliveTimeout: number;
  redis: Redis.Config;
  agents: AgentsConfig;
  rateLimits: RateLimitsConfig;
  locking: LockConfig;
}

export interface AgentsConfig {
  registerInterval: number;
}

// Batch create, update and delete share the active listings batch limit
export type RateLimitedEndpoint =
  | 'listingsBatch'
  | 'archiveBatch'
  | 'listingsGet'
  | 'archiveGet'
  | 'notificationsGet';

export type RateLimitsConfig = Record<RateLimitedEndpoint, RateLimitConfig>;

export interface RateLimitConfig {
  requests: number;
  window: number;
}

function getRateLimit(prefix: string, requests: number): RateLimitConfig {
  return {
    requests: getEnvWithDefault(
      `${prefix}_RATE_LIMIT_REQUESTS`,
      'integer',
      requests,
    ),
    window: getEnvWithDefault(
      `${prefix}_RATE_LIMIT_WINDOW`,
      'integer',
      60 * 1000,
    ),
  };
}

export default (): Config => {
  return {
    port: getEnvOrThrow('PORT', 'integer'),
    keepAliveTimeout: getEnvWithDefault('KEEP_ALIVE_TIMEOUT', 'integer', 60000),
    redis: Redis.getConfig(),
    agents: {
      registerInterval: getEnvWithDefault(
        'AGENTS_REGISTER_INTERVAL',
        'integer',
        5 * 60 * 1000,
      ),
    },
    rateLimits: {
      listingsBatch: getRateLimit('LISTINGS_BATCH', 3),
      archiveBatch: getRateLimit('ARCHIVED_LISTINGS_BATCH', 10),
      listingsGet: getRateLimit('LISTINGS_GET', 20),
      archiveGet: getRateLimit('ARCHIVED_LISTINGS_GET', 20),
      notificationsGet: getRateLimit('NOTIFICATIONS_GET', 20),
    },
    locking: getLockConfig(),
  };
};

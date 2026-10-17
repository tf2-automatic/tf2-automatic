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
  listings: ListingsConfig;
  locking: LockConfig;
}

export interface AgentsConfig {
  registerInterval: number;
}

// Batch create, update and delete share the active listings limit
export type BatchEndpoint = 'listings' | 'archive';

export interface ListingsConfig {
  rateLimits: Record<BatchEndpoint, RateLimitConfig>;
}

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
    listings: {
      rateLimits: {
        listings: getRateLimit('LISTINGS', 3),
        archive: getRateLimit('ARCHIVED_LISTINGS', 10),
      },
    },
    locking: getLockConfig(),
  };
};

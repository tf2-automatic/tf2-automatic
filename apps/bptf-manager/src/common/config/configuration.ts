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

export interface ListingsConfig {
  batchLimit: number;
  batchLimitInterval: number;
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
      batchLimit: getEnvWithDefault('LISTINGS_BATCH_LIMIT', 'integer', 3),
      batchLimitInterval: getEnvWithDefault(
        'LISTINGS_BATCH_LIMIT_INTERVAL',
        'integer',
        60 * 1000,
      ),
    },
    locking: getLockConfig(),
  };
};

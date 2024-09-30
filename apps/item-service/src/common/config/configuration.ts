import {
  EventsConfig,
  LockConfig,
  Redis,
  getEnv,
  getEnvWithDefault,
  getEventsConfig,
  getLockConfig,
} from '@tf2-automatic/config';

export interface Config {
  port: number;
  keepAliveTimeout: number;
  redis: Redis.Config;
  locking: LockConfig;
  events: EventsConfig;
  manager: ManagerConfig;
  schema: SchemaConfig;
}

export interface ManagerConfig {
  url: string;
}

export interface SchemaConfig {
  updateTimeout: number;
  limiterDuration: number;
}

export default (): Config => {
  return {
    port: getEnv('PORT', 'integer')!,
    keepAliveTimeout: getEnvWithDefault('KEEP_ALIVE_TIMEOUT', 'integer', 60000),
    redis: Redis.getConfig(),
    locking: getLockConfig(),
    events: getEventsConfig(),
    manager: {
      url: getEnv('BOT_MANAGER_URL', 'string')!,
    },
    schema: {
      updateTimeout: getEnvWithDefault(
        'SCHEMA_UPDATE_TIMEOUT',
        'integer',
        5 * 60 * 1000,
      ),
      limiterDuration: getEnvWithDefault(
        'SCHEMA_LIMITER_DURATION',
        'integer',
        1000,
      ),
    },
  };
};

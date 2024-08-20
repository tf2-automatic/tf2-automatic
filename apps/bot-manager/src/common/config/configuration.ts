import {
  EventsConfig,
  LockConfig,
  Redis,
  getEnv,
  getEnvWithDefault,
  getEventsConfig,
  getLockConfig,
} from '@tf2-automatic/config';

export interface RelayConfig {
  leaderTimeout: number;
  leaderRenewTimeout: number;
}

export interface Config {
  port: number;
  keepAliveTimeout: number;
  redis: Redis.Config;
  events: EventsConfig;
  relay: RelayConfig;
  locking: LockConfig;
}

export default (): Config => {
  return {
    port: getEnv('PORT', 'integer')!,
    keepAliveTimeout: getEnvWithDefault('KEEP_ALIVE_TIMEOUT', 'integer', 60000),
    redis: Redis.getConfig(),
    events: getEventsConfig(),
    relay: {
      leaderTimeout: getEnvWithDefault('LEADER_TIMEOUT', 'integer', 5000),
      leaderRenewTimeout: getEnvWithDefault(
        'LEADER_RENEW_TIMEOUT',
        'integer',
        10000,
      ),
    },
    locking: getLockConfig(),
  };
};

import {
  EventsConfig,
  LockConfig,
  Redis,
  getEnvOrThrow,
  getEnvWithDefault,
  getEventsConfig,
  getLockConfig,
  getRelayConfig,
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
    port: getEnvOrThrow('PORT', 'integer'),
    keepAliveTimeout: getEnvWithDefault('KEEP_ALIVE_TIMEOUT', 'integer', 60000),
    redis: Redis.getConfig(),
    events: getEventsConfig(),
    relay: getRelayConfig(),
    locking: getLockConfig(),
  };
};

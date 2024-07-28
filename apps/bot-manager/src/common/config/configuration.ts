import {
  EventsConfig,
  Redis,
  getEnv,
  getEnvWithDefault,
  getEventsConfig,
} from '@tf2-automatic/config';

export interface RelayConfig {
  leaderTimeout: number;
  leaderRenewTimeout: number;
}

export interface Config {
  port: number;
  redis: Redis.Config;
  events: EventsConfig;
  relay: RelayConfig;
}

export default (): Config => {
  return {
    port: getEnv('PORT', 'integer')!,
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
  };
};

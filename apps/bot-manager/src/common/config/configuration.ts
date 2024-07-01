import {
  EventsConfig,
  Redis,
  getEnv,
  getEventsConfig,
} from '@tf2-automatic/config';

export interface Config {
  port: number;
  redis: Redis.Config;
  events: EventsConfig;
}

export default (): Config => {
  return {
    port: getEnv('PORT', 'integer')!,
    redis: Redis.getConfig(),
    events: getEventsConfig(),
  };
};

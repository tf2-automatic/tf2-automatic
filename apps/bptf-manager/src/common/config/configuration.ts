import { Redis, getEnv, getEnvWithDefault } from '@tf2-automatic/config';

export interface Config {
  port: number;
  redis: Redis.Config;
  agents: AgentsConfig;
}

export interface AgentsConfig {
  registerInterval: number;
}

export default (): Config => {
  return {
    port: getEnv('PORT', 'integer')!,
    redis: Redis.getConfig(),
    agents: {
      registerInterval: getEnvWithDefault(
        'AGENTS_REGISTER_INTERVAL',
        'integer',
        5 * 60 * 1000,
      ),
    },
  };
};

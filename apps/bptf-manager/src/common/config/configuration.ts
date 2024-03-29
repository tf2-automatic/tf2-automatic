export interface Config {
  port: number;
  redis: RedisConfig;
  agents: AgentsConfig;
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
}

export interface AgentsConfig {
  registerInterval: number;
}

export default (): Config => {
  return {
    port: parseInt(process.env.PORT as string, 10),
    redis: {
      host: process.env.REDIS_HOST as string,
      port: parseInt(process.env.REDIS_PORT as string, 10),
      password: process.env.REDIS_PASSWORD,
      db:
        process.env.REDIS_DB !== undefined
          ? parseInt(process.env.REDIS_DB, 10)
          : undefined,
      keyPrefix: process.env.REDIS_PREFIX ?? 'tf2-automatic',
    },
    agents: {
      registerInterval:
        process.env.AGENTS_REGISTER_INTERVAL !== undefined
          ? parseInt(process.env.AGENTS_REGISTER_INTERVAL as string, 10)
          : 5 * 60 * 1000,
    },
  };
};

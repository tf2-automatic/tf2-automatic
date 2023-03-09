export interface Config {
  port: number;
  redis: RedisConfig;
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
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
      keyPrefix:
        (process.env.REDIS_PREFIX ?? 'tf2-automatic') + ':bot-manager:',
    },
  };
};

export interface Config {
  port: number;
  redis: RedisConfig;
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
}

export default (): Config => {
  return {
    port: parseInt(process.env.PORT, 10),
    redis: {
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT, 10),
      password: process.env.REDIS_PASSWORD,
      db:
        process.env.REDIS_DB !== undefined
          ? parseInt(process.env.REDIS_DB, 10)
          : undefined,
    },
  };
};

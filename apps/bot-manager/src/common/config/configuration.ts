export interface Config {
  port: number;
  redis: RedisConfig;
  rabbitmq: RabbitMQConfig;
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
}

export interface RabbitMQConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  vhost: string;
}

export default (): Config => {
  return {
    port: parseInt(process.env.PORT as string, 10),
    rabbitmq: {
      host: process.env.RABBITMQ_HOST as string,
      port: parseInt(process.env.RABBITMQ_PORT as string, 10),
      username: process.env.RABBITMQ_USERNAME as string,
      password: process.env.RABBITMQ_PASSWORD as string,
      vhost: process.env.RABBITMQ_VHOST as string,
    },
    redis: {
      host: process.env.REDIS_HOST as string,
      port: parseInt(process.env.REDIS_PORT as string, 10),
      password: process.env.REDIS_PASSWORD,
      db:
        process.env.REDIS_DB !== undefined
          ? parseInt(process.env.REDIS_DB, 10)
          : undefined,
      keyPrefix: (process.env.REDIS_PREFIX ?? 'tf2-automatic') + ':bot-manager',
    },
  };
};

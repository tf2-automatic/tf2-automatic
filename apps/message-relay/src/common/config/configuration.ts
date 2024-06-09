import { RabbitMQ, Redis, getEnv } from '@tf2-automatic/config';

export interface Config {
  port: number;
  redis: Redis.Config;
  rabbitmq: RabbitMQ.Config;
}

export default (): Config => {
  return {
    port: getEnv('PORT', 'integer')!,
    rabbitmq: RabbitMQ.getConfig(),
    redis: Redis.getConfig(),
  };
};

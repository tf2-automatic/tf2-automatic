export interface Config {
  port: number;
  steam: SteamAccountConfig;
  rabbitmq: RabbitMQConfig;
  dataDir: string;
}

export interface SteamAccountConfig {
  username: string;
  password: string;
  sharedSecret: string;
  identitySecret: string;
}

export interface RabbitMQConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  vhost: string;
  prefix: string;
}

export default (): Config => {
  return {
    port: parseInt(process.env.PORT as string, 10),
    steam: {
      username: process.env.STEAM_USERNAME as string,
      password: process.env.STEAM_PASSWORD as string,
      sharedSecret: process.env.STEAM_SHARED_SECRET as string,
      identitySecret: process.env.STEAM_IDENTITY_SECRET as string,
    },
    rabbitmq: {
      host: process.env.RABBITMQ_HOST as string,
      port: parseInt(process.env.RABBITMQ_PORT as string, 10),
      username: process.env.RABBITMQ_USERNAME as string,
      password: process.env.RABBITMQ_PASSWORD as string,
      vhost: process.env.RABBITMQ_VHOST as string,
      prefix: (process.env.RABBITMQ_PREFIX as string) ?? 'tf2-automatic',
    },
    dataDir: process.env.DATA_DIR as string,
  };
};

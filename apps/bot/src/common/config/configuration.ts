export interface Config {
  port: number;
  steam: SteamAccountConfig;
  rabbitmq: RabbitMQConfig;
  storage: S3StorageConfig | LocalStorageConfig;
}

export interface SteamAccountConfig {
  username: string;
  password: string;
  sharedSecret: string;
  identitySecret: string;
  proxyUrl?: string;
}

export interface RabbitMQConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  vhost: string;
  prefix: string;
}

export type StorageConfig = S3StorageConfig | LocalStorageConfig;

export interface S3StorageConfig extends BaseStorageConfig {
  type: 's3';
  endpoint: string;
  port: number;
  useSSL: boolean;
  bucket: string;
  directory: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export interface LocalStorageConfig extends BaseStorageConfig {
  type: 'local';
  directory: string;
}

interface BaseStorageConfig {
  type: unknown;
}

export default (): Config => {
  return {
    port: parseInt(process.env.PORT as string, 10),
    steam: {
      username: process.env.STEAM_USERNAME as string,
      password: process.env.STEAM_PASSWORD as string,
      sharedSecret: process.env.STEAM_SHARED_SECRET as string,
      identitySecret: process.env.STEAM_IDENTITY_SECRET as string,
      proxyUrl: process.env.STEAM_PROXY_URL as string | undefined,
    },
    rabbitmq: {
      host: process.env.RABBITMQ_HOST as string,
      port: parseInt(process.env.RABBITMQ_PORT as string, 10),
      username: process.env.RABBITMQ_USERNAME as string,
      password: process.env.RABBITMQ_PASSWORD as string,
      vhost: process.env.RABBITMQ_VHOST as string,
      prefix: (process.env.RABBITMQ_PREFIX as string) ?? 'tf2-automatic',
    },
    storage: getStorageConfig(),
  };
};

function getStorageConfig(): StorageConfig {
  const storageType = process.env.STORAGE_TYPE as 's3' | 'local';

  if (storageType === 'local') {
    return {
      type: storageType,
      directory: process.env.STORAGE_LOCAL_PATH as string,
    } satisfies LocalStorageConfig;
  } else if (storageType === 's3') {
    return {
      type: storageType,
      directory: process.env.STORAGE_S3_PATH as string,
      endpoint: process.env.STORAGE_S3_ENDPOINT as string,
      port: parseInt(process.env.STORAGE_S3_PORT as string, 10),
      useSSL: process.env.STORAGE_S3_USE_SSL === 'true',
      bucket: process.env.STORAGE_S3_BUCKET as string,
      accessKeyId: process.env.STORAGE_S3_ACCESS_KEY_ID as string,
      secretAccessKey: process.env.STORAGE_S3_SECRET_ACCESS_KEY as string,
    } satisfies S3StorageConfig;
  } else {
    throw new Error('Unknown task type: ' + storageType);
  }
}

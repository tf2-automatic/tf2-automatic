export interface Config {
  port: number;
  ip?: string;
  steam: SteamAccountConfig;
  trade: SteamTradeConfig;
  rabbitmq: RabbitMQConfig;
  storage: S3StorageConfig | LocalStorageConfig;
  manager: ManagerConfig;
}

export interface SteamAccountConfig {
  username: string;
  password: string;
  sharedSecret: string;
  identitySecret: string;
  proxyUrl?: string;
  apiKey?: string;
}

export interface SteamTradeConfig {
  cancelTime?: number;
  pendingCancelTime?: number;
  pollInterval: number;
  pollFullUpdateInterval: number;
}

export interface RabbitMQConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  vhost: string;
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

export interface ManagerConfig {
  enabled: boolean;
  url?: string;
  heartbeatInterval?: number;
}

export default (): Config => {
  return {
    port: parseInt(process.env.PORT as string, 10),
    ip: process.env.IP_ADDRESS as string | undefined,
    steam: {
      username: process.env.STEAM_USERNAME as string,
      password: process.env.STEAM_PASSWORD as string,
      sharedSecret: process.env.STEAM_SHARED_SECRET as string,
      identitySecret: process.env.STEAM_IDENTITY_SECRET as string,
      proxyUrl: process.env.STEAM_PROXY_URL as string | undefined,
      apiKey: process.env.STEAM_API_KEY as string | undefined,
    },
    trade: {
      cancelTime:
        process.env.TRADE_CANCEL_TIME === undefined
          ? undefined
          : parseInt(process.env.TRADE_CANCEL_TIME as string, 10),
      pendingCancelTime:
        process.env.TRADE_PENDING_CANCEL_TIME === undefined
          ? undefined
          : parseInt(process.env.TRADE_PENDING_CANCEL_TIME as string, 10),
      pollInterval:
        process.env.TRADE_POLL_INTERVAL === undefined
          ? 30 * 1000 // 30 seconds
          : parseInt(process.env.TRADE_POLL_INTERVAL as string, 10),
      pollFullUpdateInterval:
        process.env.TRADE_POLL_FULL_UPDATE_INTERVAL === undefined
          ? 2 * 60 * 1000 // 2 hours
          : parseInt(process.env.TRADE_POLL_FULL_UPDATE_INTERVAL as string, 10),
    },
    rabbitmq: {
      host: process.env.RABBITMQ_HOST as string,
      port: parseInt(process.env.RABBITMQ_PORT as string, 10),
      username: process.env.RABBITMQ_USERNAME as string,
      password: process.env.RABBITMQ_PASSWORD as string,
      vhost: process.env.RABBITMQ_VHOST as string,
    },
    storage: getStorageConfig(),
    manager: {
      enabled: process.env.BOT_MANAGER_ENABLED === 'true',
      url: process.env.BOT_MANAGER_URL,
      heartbeatInterval:
        process.env.BOT_MANAGER_HEARTBEAT_INTERVAL === undefined
          ? 60000
          : parseInt(process.env.BOT_MANAGER_HEARTBEAT_INTERVAL as string, 10),
    },
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

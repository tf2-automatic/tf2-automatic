import {
  EventsConfig,
  getEnv,
  getEnvWithDefault,
  getEventsConfig,
} from '@tf2-automatic/config';

export interface Config {
  port: number;
  ip?: string;
  steam: SteamAccountConfig;
  trade: SteamTradeConfig;
  events: EventsConfig;
  storage: StorageConfig;
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

export type StorageConfig = S3StorageConfig | LocalStorageConfig;

export interface S3StorageConfig extends BaseChoiceConfig {
  type: 's3';
  endpoint: string;
  port: number;
  useSSL: boolean;
  bucket: string;
  directory: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export interface LocalStorageConfig extends BaseChoiceConfig {
  type: 'local';
  directory: string;
}

interface BaseChoiceConfig {
  type: unknown;
}

export interface ManagerConfig {
  enabled: boolean;
  url?: string;
  heartbeatInterval?: number;
}

export default (): Config => {
  return {
    port: getEnv('PORT', 'integer')!,
    ip: getEnv('IP_ADDRESS', 'string'),
    steam: {
      username: getEnv('STEAM_USERNAME', 'string')!,
      password: getEnv('STEAM_PASSWORD', 'string')!,
      sharedSecret: getEnv('STEAM_SHARED_SECRET', 'string')!,
      identitySecret: getEnv('STEAM_IDENTITY_SECRET', 'string')!,
      proxyUrl: getEnv('STEAM_PROXY_URL', 'string'),
      apiKey: getEnv('STEAM_API_KEY', 'string'),
    },
    trade: {
      cancelTime: getEnv('TRADE_CANCEL_TIME', 'integer'),
      pendingCancelTime: getEnv('TRADE_PENDING_CANCEL_TIME', 'integer'),
      pollInterval: getEnvWithDefault(
        'TRADE_POLL_INTERVAL',
        'integer',
        30 * 1000,
      ),
      pollFullUpdateInterval: getEnvWithDefault(
        'TRADE_POLL_FULL_UPDATE_INTERVAL',
        'integer',
        2 * 60 * 1000,
      ),
    },
    events: getEventsConfig(),
    storage: getStorageConfig(),
    manager: {
      enabled: getEnv('BOT_MANAGER_ENABLED', 'boolean'),
      url: getEnv('BOT_MANAGER_URL', 'string'),
      heartbeatInterval: getEnvWithDefault(
        'BOT_MANAGER_HEARTBEAT_INTERVAL',
        'integer',
        60000,
      ),
    },
  };
};

function getStorageConfig(): StorageConfig {
  const storageType = getEnv('STORAGE_TYPE', 'string') as 's3' | 'local';

  if (storageType === 'local') {
    return {
      type: storageType,
      directory: getEnv('STORAGE_LOCAL_PATH', 'string')!,
    } satisfies LocalStorageConfig;
  } else if (storageType === 's3') {
    return {
      type: storageType,
      directory: getEnv('STORAGE_S3_PATH', 'string')!,
      endpoint: getEnv('STORAGE_S3_ENDPOINT', 'string')!,
      port: getEnv('STORAGE_S3_PORT', 'integer')!,
      useSSL: getEnv('STORAGE_S3_USE_SSL', 'boolean'),
      bucket: getEnv('STORAGE_S3_BUCKET', 'string')!,
      accessKeyId: getEnv('STORAGE_S3_ACCESS_KEY_ID', 'string')!,
      secretAccessKey: getEnv('STORAGE_S3_SECRET_ACCESS_KEY', 'string')!,
    } satisfies S3StorageConfig;
  } else {
    throw new Error('Unknown storage type: ' + storageType);
  }
}

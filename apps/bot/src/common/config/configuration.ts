import {
  EventsConfig,
  getEnv,
  getEnvWithDefault,
  getEventsConfig,
  getStorageConfig,
  StorageConfig,
} from '@tf2-automatic/config';

export interface Config {
  port: number;
  keepAliveTimeout: number;
  ip?: string;
  webSessionRefreshInterval: number;
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
  pollDataForgetTime: number;
}

export interface ManagerConfig {
  enabled: boolean;
  url?: string;
  heartbeatInterval?: number;
}

export default (): Config => {
  return {
    port: getEnv('PORT', 'integer')!,
    // The bot has long lived requests so we don't want to timeout
    keepAliveTimeout: getEnvWithDefault('KEEP_ALIVE_TIMEOUT', 'integer', 0),
    ip: getEnv('IP_ADDRESS', 'string'),
    webSessionRefreshInterval: getEnvWithDefault(
      'WEB_SESSION_REFRESH_INTERVAL',
      'integer',
      10 * 60 * 1000,
    ),
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
      pollDataForgetTime: getEnvWithDefault(
        'TRADE_POLL_DATA_FORGET_TIME',
        'integer',
        14 * 24 * 60 * 1000,
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
        20000,
      ),
    },
  };
};

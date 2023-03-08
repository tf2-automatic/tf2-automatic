export const BOT_BASE_URL = 'bots';
export const BOTS_PATH = '/';
export const BOT_PATH = '/:steamid';
export const BOT_HEARTBEAT_PATH = `${BOT_PATH}/heartbeat`;

export interface BotHeartbeat {
  ip: string;
  port: number;
}

export interface Bot {
  steamid64: string;
  ip: string;
  port: number;
  lastSeen: number;
}

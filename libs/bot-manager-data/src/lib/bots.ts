export const BOT_BASE_URL = '/bots';
export const BOTS_PATH = '/';
export const BOT_PATH = '/:steamid';

export interface Bot {
  steamid64: string;
  ip: string;
  port: number;
  interval: number;
  lastSeen: number;
}

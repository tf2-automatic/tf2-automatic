export const BOT_BASE_URL = '/bots';
export const BOTS_PATH = '/';
export const BOT_PATH = '/:steamid';

export const BOTS_FULL_PATH = `${BOT_BASE_URL}`;
export const BOT_FULL_PATH = `${BOT_BASE_URL}${BOT_PATH}`;

export interface Bot {
  steamid64: string;
  ip: string;
  port: number;
  interval: number;
  version: string | null;
  running: boolean;
  lastSeen: number;
}

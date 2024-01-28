export const BOT_BASE_URL = '/bots';
export const BOTS_PATH = '/';
export const BOT_PATH = '/:steamid';
// Full paths for use when making HTTP requests
export const BOT_FULL_PATH = `${BOT_BASE_URL}${BOT_PATH}`;
export const BOTS_FULL_PATH = `${BOT_BASE_URL}`;

export interface Bot {
  steamid64: string;
  ip: string;
  port: number;
  interval: number;
  version: string | null;
  lastSeen: number;
}

export const HEARTBEAT_BASE_URL = '/heartbeats';
export const HEARTBEAT_PATH = '/:steamid';

export interface BotHeartbeat {
  ip: string;
  port: number;
}

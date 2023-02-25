import { IsInt, IsIP } from 'class-validator';

export const BOT_BASE_URL = 'bots';
export const BOT_PATH = '/:steamid';
export const BOT_HEARTBEAT_PATH = `${BOT_PATH}/heartbeat`;

export class BotHeartbeatDto {
  @IsIP(4)
  ip: string;

  @IsInt()
  port: number;
}

export interface Bot {
  steamid64: string;
  ip: string;
  port: number;
  lastSeen: number;
}

import { BaseEvent } from '@tf2-automatic/bot-data';
import { Bot } from './bots';

export const HEARTBEAT_BASE_URL = '/heartbeats';
export const HEARTBEAT_PATH = '/:steamid';
// Full path for use when making HTTP requests
export const HEARTBEAT_FULL_PATH = `${HEARTBEAT_BASE_URL}${HEARTBEAT_PATH}`;

export interface BotHeartbeat {
  ip: string;
  port: number;
  interval: number;
  version?: string;
}

export const BOT_EVENT_PREFIX = 'bots';

export type BotHeartbeatEventType = 'bots.heartbeat';
export const BOT_HEARTBEAT_EVENT: BotHeartbeatEventType = `${BOT_EVENT_PREFIX}.heartbeat`;

export type BotDeletedEventType = 'bots.deleted';
export const BOT_DELETED_EVENT: BotDeletedEventType = `${BOT_EVENT_PREFIX}.deleted`;

export type BotHeartbeatEvent = BaseEvent<BotHeartbeatEventType, Bot>;
export type BotDeletedEvent = BaseEvent<BotDeletedEventType, Bot>;

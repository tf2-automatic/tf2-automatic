import type SteamUser from 'steam-user';
import { BaseEvent } from './events';

export const STEAM_EVENT_PREFIX = 'steam';

export type SteamConnectedEventType = 'steam.connected';
export type SteamDisconnectedEventType = 'steam.disconnected';

export const STEAM_CONNECTED_EVENT: SteamConnectedEventType = `${STEAM_EVENT_PREFIX}.connected`;
export const STEAM_DISCONNECTED_EVENT: SteamDisconnectedEventType = `${STEAM_EVENT_PREFIX}.disconnected`;

export type SteamConnectedEvent = BaseEvent<SteamConnectedEventType>;

export type SteamDisconnectedEvent = BaseEvent<
  SteamDisconnectedEventType,
  {
    eresult: SteamUser.EResult;
    msg?: string;
  }
>;

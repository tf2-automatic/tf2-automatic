import SteamUser from 'steam-user';
import { BaseEvent } from './events';

export const STEAM_CONNECTED_EVENT = 'steam.connected';
export const STEAM_DISCONNECTED_EVENT = 'steam.disconnected';

export interface SteamConnectedEvent extends BaseEvent {
  type: typeof STEAM_CONNECTED_EVENT;
}

export interface SteamDisconnectedEvent extends BaseEvent {
  type: typeof STEAM_DISCONNECTED_EVENT;
  data: {
    eresult: SteamUser.EResult;
    msg: string;
  };
}

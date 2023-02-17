import { IsNotEmpty, IsString } from 'class-validator';
import SteamUser from 'steam-user';
import { BaseEvent } from './events';

export interface Friend {
  steamid64: string;
  isFriend: boolean;
  isInvited: boolean;
  hasInvitedUs: boolean;
}

export type Friends = Friend[];

export interface AddFriend {
  added: boolean;
}

export interface DeleteFriend {
  deleted: boolean;
}

export class SendFriendMessageDto {
  @IsNotEmpty()
  @IsString()
  message: string;
}

export interface SendFriendMessageResponse {
  modified_message: string;
  server_timestamp: number;
  ordinal: number;
}

export const FRIENDS_BASE_PATH = '/friends';
export const GET_FRIENDS = '/';
export const GET_FRIEND = '/:steamid';
export const ADD_FRIEND = '/:steamid';
export const DELETE_FRIEND = '/:steamid';
export const SEND_FRIEND_MESSAGE = '/:steamid/message';
export const SEND_FRIEND_TYPING = '/:steamid/typing';

export const FRIEND_RELATIONSHIP_EVENT = 'friend.relationship';
export const FRIEND_MESSAGE_EVENT = 'friend.message';
export const FRIEND_TYPING_EVENT = 'friend.typing';

export interface FriendRelationshipEvent extends BaseEvent {
  type: typeof FRIEND_RELATIONSHIP_EVENT;
  data: {
    steamid64: string;
    relationship: SteamUser.EFriendRelationship;
    oldRelationship: SteamUser.EFriendRelationship;
  };
}

export interface FriendMessageEvent extends BaseEvent {
  type: typeof FRIEND_MESSAGE_EVENT;
  data: {
    steamid64: string;
    timestamp: number;
    ordinal: number;
    message: string;
  };
}

export interface FriendTypingEvent extends BaseEvent {
  type: typeof FRIEND_TYPING_EVENT;
  data: {
    steamid64: string;
    timestamp: number;
    ordinal: number;
  };
}

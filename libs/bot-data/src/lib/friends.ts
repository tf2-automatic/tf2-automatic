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

export interface AddFriendResponse {
  added: boolean;
}

export interface DeleteFriendResponse {
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

export const FRIENDS_BASE_URL = '/friends';
export const FRIENDS_PATH = '/';
export const FRIEND_PATH = '/:steamid';
export const FRIEND_MESSAGE_PATH = `${FRIENDS_PATH}/message`;
export const FRIEND_TYPING_PATH = `${FRIENDS_PATH}/typing`;

export const FRIEND_EVENT_PREFIX = 'friends';
export const FRIEND_RELATIONSHIP_EVENT = `${FRIEND_EVENT_PREFIX}.relationship`;
export const FRIEND_MESSAGE_EVENT = `${FRIEND_EVENT_PREFIX}.message`;
export const FRIEND_TYPING_EVENT = `${FRIEND_EVENT_PREFIX}.typing`;

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

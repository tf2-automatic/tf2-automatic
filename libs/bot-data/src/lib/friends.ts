import type SteamUser from 'steam-user';
import { BaseEvent } from './events';

export interface Friend {
  steamid64: string;
  relationship: SteamUser.EFriendRelationship;
}

export type Friends = Friend[];

export interface AddFriendResponse {
  added: boolean;
}

export interface DeleteFriendResponse {
  deleted: boolean;
}

export interface SendFriendMessage {
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
export const FRIEND_MESSAGE_PATH = `${FRIEND_PATH}/message`;
export const FRIEND_TYPING_PATH = `${FRIEND_PATH}/typing`;
export const FRIEND_BLOCK_PATH = `${FRIEND_PATH}/block`;
// Full paths for use when making HTTP requests
export const FRIENDS_FULL_PATH = `${FRIENDS_BASE_URL}`;
export const FRIEND_FULL_PATH = `${FRIENDS_BASE_URL}${FRIEND_PATH}`;
export const FRIEND_MESSAGE_FULL_PATH = `${FRIENDS_BASE_URL}${FRIEND_MESSAGE_PATH}`;
export const FRIEND_TYPING_FULL_PATH = `${FRIENDS_BASE_URL}${FRIEND_TYPING_PATH}`;
export const FRIEND_BLOCK_FULL_PATH = `${FRIENDS_BASE_URL}${FRIEND_BLOCK_PATH}`;
export const FRIEND_UNBLOCK_FULL_PATH = `${FRIENDS_BASE_URL}${FRIEND_BLOCK_PATH}`;

export type FriendRelationshipEventType = 'friends.relationship';
export type FriendMessageEventType = 'friends.message';
export type FriendTypingEventType = 'friends.typing';

export const FRIEND_EVENT_PREFIX = 'friends';
export const FRIEND_RELATIONSHIP_EVENT: FriendRelationshipEventType = `${FRIEND_EVENT_PREFIX}.relationship`;
export const FRIEND_MESSAGE_EVENT: FriendMessageEventType = `${FRIEND_EVENT_PREFIX}.message`;
export const FRIEND_TYPING_EVENT: FriendTypingEventType = `${FRIEND_EVENT_PREFIX}.typing`;

export type FriendRelationshipEvent = BaseEvent<
  FriendRelationshipEventType,
  {
    steamid64: string;
    relationship: SteamUser.EFriendRelationship;
    oldRelationship: SteamUser.EFriendRelationship;
  }
>;

export type FriendMessageEvent = BaseEvent<
  FriendMessageEventType,
  {
    steamid64: string;
    timestamp: number;
    ordinal: number;
    message: string;
  }
>;

export type FriendTypingEvent = BaseEvent<
  FriendTypingEventType,
  {
    steamid64: string;
    timestamp: number;
    ordinal: number;
  }
>;

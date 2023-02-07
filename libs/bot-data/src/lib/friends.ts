import { IsNotEmpty, IsString } from 'class-validator';

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
export const GET_FRIEND = '/';
export const ADD_FRIEND = '/:steamid';
export const DELETE_FRIEND = '/:steamid';
export const SEND_FRIEND_MESSAGE = '/:steamid/message';
export const SEND_FRIEND_TYPING = '/:steamid/typing';

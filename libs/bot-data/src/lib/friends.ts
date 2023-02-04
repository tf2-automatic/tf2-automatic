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

export const FRIENDS_BASE_PATH = '/friends';
export const GET_FRIENDS = '/';
export const GET_FRIEND = '/';
export const ADD_FRIEND = '/:steamid';
export const DELETE_FRIEND = '/:steamid';

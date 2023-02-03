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

export const basePath = '/friends';
export const getFriendsPath = '/';
export const addFriendPath = '/:steamid';
export const deleteFriendPath = '/:steamid';

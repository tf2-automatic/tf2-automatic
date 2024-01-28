import type SteamCommunity from 'steamcommunity';

export interface UpdateCustomGame {
  name: string;
}

export interface UpdateProfileAvatar {
  url: string;
}

export interface UpdateProfile {
  name?: string | null;
  realName?: string | null;
  summary?: string | null;
  country?: string | null;
  state?: string | null;
  city?: string | null;
  customURL?: string | null;
  background?: string | null;
  featuredBadge?: string | null;
  primaryGroup?: string | null;
}

export interface UpdateProfileSettings {
  profile?: SteamCommunity.PrivacyState;
  comments?: SteamCommunity.PrivacyState;
  inventory?: SteamCommunity.PrivacyState;
  inventoryGifts?: boolean;
  gameDetails?: SteamCommunity.PrivacyState;
  playtime?: boolean;
  friendList?: SteamCommunity.PrivacyState;
}

export interface UpdateProfileAvatarResponse {
  success: boolean;
}

export interface TradeOfferUrlResponse {
  url: string;
}

export const PROFILE_BASE_URL = '/profile';
export const PROFILE_AVATAR_PATH = '/avatar';
export const PROFILE_PATH = '/';
export const PROFILE_SETTINGS_PATH = '/settings';
export const PROFILE_NAME_PATH = '/name';
export const PROFILE_TRADEOFFERURL_PATH = '/tradeofferurl';
export const PROFILE_CUSTOM_GAME_PATH = '/game';
// Full paths for use when making HTTP requests
export const PROFILE_AVATAR_FULL_PATH = `${PROFILE_BASE_URL}${PROFILE_AVATAR_PATH}`;
export const PROFILE_EDIT_FULL_PATH = `${PROFILE_BASE_URL}`;
export const PROFILE_SETTINGS_FULL_PATH = `${PROFILE_BASE_URL}${PROFILE_SETTINGS_PATH}`;
export const PROFILE_NAME_HISTORY_FULL_PATH = `${PROFILE_BASE_URL}${PROFILE_NAME_PATH}`;
export const PROFILE_TRADEOFFERURL_FULL_PATH = `${PROFILE_BASE_URL}${PROFILE_TRADEOFFERURL_PATH}`;
export const PROFILE_CUSTOM_GAME_FULL_PATH = `${PROFILE_BASE_URL}${PROFILE_CUSTOM_GAME_PATH}`;

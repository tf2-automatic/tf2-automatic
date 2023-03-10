import type SteamCommunity from 'steamcommunity';

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

export class UpdateProfileSettings {
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

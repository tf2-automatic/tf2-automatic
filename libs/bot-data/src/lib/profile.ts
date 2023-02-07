import { IsSteamID } from '@tf2-automatic/is-steamid-validator';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
} from 'class-validator';
import { Type } from 'class-transformer';
import SteamCommunity from 'steamcommunity';

export class UpdateProfileAvatarDto {
  @IsUrl({
    protocols: ['http', 'https'],
  })
  url: string;
}

export class UpdateProfileDto {
  @IsString()
  @IsOptional()
  name?: string | null;

  @IsString()
  @IsOptional()
  realName?: string | null;

  @IsString()
  @IsOptional()
  summary?: string | null;

  @IsString()
  @IsOptional()
  country?: string | null;

  @IsString()
  @IsOptional()
  state?: string | null;

  @IsString()
  @IsOptional()
  city?: string | null;

  @IsString()
  @IsOptional()
  customURL?: string | null;

  @IsString()
  @IsOptional()
  background?: string | null;

  @IsString()
  @IsOptional()
  featuredBadge?: string | null;

  @IsOptional()
  @IsSteamID()
  primaryGroup?: string | null;
}

export class UpdateProfileSettingsDto {
  @IsOptional()
  @IsEnum(SteamCommunity.PrivacyState)
  @Type(() => Number)
  profile?: SteamCommunity.PrivacyState;

  @IsOptional()
  @IsEnum(SteamCommunity.PrivacyState)
  @Type(() => Number)
  comments?: SteamCommunity.PrivacyState;

  @IsOptional()
  @IsEnum(SteamCommunity.PrivacyState)
  @Type(() => Number)
  inventory?: SteamCommunity.PrivacyState;

  @IsOptional()
  @IsBoolean()
  inventoryGifts?: boolean;

  @IsOptional()
  @IsEnum(SteamCommunity.PrivacyState)
  @Type(() => Number)
  gameDetails?: SteamCommunity.PrivacyState;

  @IsOptional()
  @IsBoolean()
  playtime?: boolean;

  @IsOptional()
  @IsEnum(SteamCommunity.PrivacyState)
  @Type(() => Number)
  friendList?: SteamCommunity.PrivacyState;
}

export interface UpdateProfileAvatarResponse {
  success: boolean;
}

export interface TradeOfferUrlResponse {
  url: string;
}

export const PROFILE_BASE_URL = '/profile';
export const PROFILE_UPDATE_AVATAR = '/avatar';
export const PROFILE_UPDATE_PROFILE = '/';
export const PROFILE_UPDATE_PROFILE_SETTINGS = '/settings';
export const PROFILE_DELETE_NAME_HISTORY = '/name';
export const PROFILE_GET_TRADE_OFFER_URL = '/tradeofferurl';
export const PROFILE_CHANGE_TRADE_OFFER_URL = '/tradeofferurl';

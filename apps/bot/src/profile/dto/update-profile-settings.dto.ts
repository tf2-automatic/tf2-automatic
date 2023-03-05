import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import SteamCommunity from 'steamcommunity';

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

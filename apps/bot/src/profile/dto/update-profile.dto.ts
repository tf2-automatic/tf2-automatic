import { UpdateProfile } from '@tf2-automatic/bot-data';
import { IsSteamID } from '@tf2-automatic/is-steamid-validator';
import { IsOptional, IsString } from 'class-validator';

export class UpdateProfileDto implements UpdateProfile {
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

import { ApiProperty } from '@nestjs/swagger';
import {
  UpdateCustomGame,
  UpdateCustomPersonaState,
  UpdateGames,
  UpdateProfile,
  UpdateProfileAvatar,
  UpdateProfileSettings,
} from '@tf2-automatic/bot-data';
import { IsSteamID } from '@tf2-automatic/is-steamid-validator';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
} from 'class-validator';
import SteamUser from 'steam-user';
import SteamCommunity from 'steamcommunity';

export class UpdateProfileAvatarDto implements UpdateProfileAvatar {
  @ApiProperty({
    description: 'The new avatar url',
    example:
      'https://avatars.akamai.steamstatic.com/8903f73ef9dab679c4712f07fcd570d13ce01c1d_full.jpg',
  })
  @IsUrl({
    protocols: ['http', 'https'],
  })
  url: string;
}

export class UpdateCustomGameDto implements UpdateCustomGame {
  @ApiProperty({
    description: 'The custom game name',
    example: 'A super cool game!',
  })
  @IsString()
  @IsNotEmpty()
  name: string;
}

export class UpdateGamesDto implements UpdateGames {
  @ApiProperty({
    description: 'A list of appids',
    example: [440, 570, 730],
  })
  @IsArray()
  @Type(() => String)
  appids: number[];
}

export class UpdateCustomPersonaStateDto implements UpdateCustomPersonaState {
  @ApiProperty({
    description: 'The custom persona state',
    example: SteamUser.EPersonaState.Online,
    type: Number,
    required: true,
  })
  @IsEnum(SteamUser.EPersonaState)
  @Type(() => Number)
  state: SteamUser.EPersonaState;
}

export class UpdateProfileSettingsDto implements UpdateProfileSettings {
  @ApiProperty({
    description: 'The privacy state of the profile',
    example: SteamCommunity.PrivacyState.Public,
    required: false,
    type: Number,
    enum: SteamCommunity.PrivacyState,
  })
  @IsOptional()
  @IsEnum(SteamCommunity.PrivacyState)
  @Type(() => Number)
  profile?: SteamCommunity.PrivacyState;

  @ApiProperty({
    description: 'The privacy state for commenting on the profile',
    example: SteamCommunity.PrivacyState.Public,
    required: false,
    type: Number,
    enum: SteamCommunity.PrivacyState,
  })
  @IsOptional()
  @IsEnum(SteamCommunity.PrivacyState)
  @Type(() => Number)
  comments?: SteamCommunity.PrivacyState;

  @ApiProperty({
    description: 'The privacy state for viewing the inventory',
    example: SteamCommunity.PrivacyState.Public,
    required: false,
    type: Number,
    enum: SteamCommunity.PrivacyState,
  })
  @IsOptional()
  @IsEnum(SteamCommunity.PrivacyState)
  @Type(() => Number)
  inventory?: SteamCommunity.PrivacyState;

  @ApiProperty({
    description: 'The privacy state for viewing the gifts inventory',
    example: true,
    required: false,
    type: Boolean,
  })
  @IsOptional()
  @IsBoolean()
  inventoryGifts?: boolean;

  @ApiProperty({
    description: 'The privacy state for viewing game details',
    example: SteamCommunity.PrivacyState.Public,
    required: false,
    type: Number,
    enum: SteamCommunity.PrivacyState,
  })
  @IsOptional()
  @IsEnum(SteamCommunity.PrivacyState)
  @Type(() => Number)
  gameDetails?: SteamCommunity.PrivacyState;

  @ApiProperty({
    description: 'The privacy state for viewing the playtime',
    example: true,
    required: false,
    type: Boolean,
  })
  @IsOptional()
  @IsBoolean()
  playtime?: boolean;

  @ApiProperty({
    description: 'The privacy state for viewing the friends list',
    example: SteamCommunity.PrivacyState.Public,
    required: false,
    type: Number,
    enum: SteamCommunity.PrivacyState,
  })
  @IsOptional()
  @IsEnum(SteamCommunity.PrivacyState)
  @Type(() => Number)
  friendList?: SteamCommunity.PrivacyState;
}

export class UpdateProfileDto implements UpdateProfile {
  @ApiProperty({
    required: false,
    type: String,
  })
  @IsString()
  @IsOptional()
  name?: string | null;

  @ApiProperty({
    required: false,
    type: String,
  })
  @IsString()
  @IsOptional()
  realName?: string | null;

  @ApiProperty({
    required: false,
    type: String,
  })
  @IsString()
  @IsOptional()
  summary?: string | null;

  @ApiProperty({
    required: false,
    type: String,
  })
  @IsString()
  @IsOptional()
  country?: string | null;

  @ApiProperty({
    required: false,
    type: String,
  })
  @IsString()
  @IsOptional()
  state?: string | null;

  @ApiProperty({
    required: false,
    type: String,
  })
  @IsString()
  @IsOptional()
  city?: string | null;

  @ApiProperty({
    required: false,
    type: String,
  })
  @IsString()
  @IsOptional()
  customURL?: string | null;

  @ApiProperty({
    required: false,
    type: String,
  })
  @IsString()
  @IsOptional()
  background?: string | null;

  @ApiProperty({
    required: false,
    type: String,
  })
  @IsString()
  @IsOptional()
  featuredBadge?: string | null;

  @ApiProperty({
    required: false,
    type: String,
  })
  @IsOptional()
  @IsSteamID()
  primaryGroup?: string | null;
}

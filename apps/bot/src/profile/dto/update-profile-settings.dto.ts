import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import SteamCommunity from 'steamcommunity';

export class UpdateProfileSettingsDto {
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

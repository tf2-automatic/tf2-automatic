import { ApiProperty } from '@nestjs/swagger';
import { UpdateProfile } from '@tf2-automatic/bot-data';
import { IsSteamID } from '@tf2-automatic/is-steamid-validator';
import { IsOptional, IsString } from 'class-validator';

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

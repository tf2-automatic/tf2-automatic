import { ApiProperty } from '@nestjs/swagger';
import { IsSteamID } from '@tf2-automatic/is-steamid-validator';
import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import SteamID from 'steamid';

export class GetEscrowDto {
  @ApiProperty({
    example: '76561198120070906',
    description: 'The SteamID64 of the bot you want to check the escrow for',
    type: String,
    required: false,
  })
  @IsOptional()
  @IsSteamID()
  @Transform((params) => new SteamID(params.value))
  bot?: SteamID;

  @ApiProperty({
    example: '_Eq1Y3An',
    description: 'The trade offer token of the user',
    type: String,
    required: false,
  })
  @IsOptional()
  @IsString()
  token?: string;

  @ApiProperty({
    example: '9106130714',
    description: 'The ID of an existing trade offer',
    type: String,
    required: false,
  })
  @IsOptional()
  @IsString()
  offerId?: string;

  @ApiProperty({
    description:
      'The time that the result will be cached for in seconds. -1 means forever.',
    example: 3600,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(-1)
  @Max(Number.MAX_SAFE_INTEGER)
  @Type(() => Number)
  ttl?: number;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsSteamID } from '@tf2-automatic/is-steamid-validator';
import { IsString } from 'class-validator';

export const TOKENS_BASE_URL = '/tokens';
export const TOKENS_PATH = '/';
export const TOKEN_PATH = '/:steamid';

export interface Token {
  steamid64: string;
  value: string;
}

export class SaveTokenDto implements Token {
  @ApiProperty({
    example: '76561198120070906',
    description: 'The SteamID64 of the account associated with the token',
    type: String,
  })
  @IsSteamID()
  steamid64!: string;

  @ApiProperty({
    description: 'A backpack.tf API token',
    type: String,
  })
  @IsString()
  value!: string;
}

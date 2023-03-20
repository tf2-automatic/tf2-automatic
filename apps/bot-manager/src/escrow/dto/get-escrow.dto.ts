import { ApiProperty } from '@nestjs/swagger';
import { IsSteamID } from '@tf2-automatic/is-steamid-validator';
import { Transform } from 'class-transformer';
import { IsOptional } from 'class-validator';
import SteamID from 'steamid';

export class GetEscrowDto {
  @ApiProperty({
    example: '76561198120070906',
    description: 'The SteamID64 of the bot you want to check the escrow for',
    type: String,
  })
  @IsSteamID()
  @IsOptional()
  @Transform((params) => new SteamID(params.value))
  bot?: SteamID;
}

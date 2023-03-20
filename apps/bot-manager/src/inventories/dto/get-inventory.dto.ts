import { ApiProperty } from '@nestjs/swagger';
import { IsSteamID } from '@tf2-automatic/is-steamid-validator';
import { Transform } from 'class-transformer';
import { IsOptional } from 'class-validator';
import SteamID from 'steamid';

export class GetInventoryDto {
  @ApiProperty({
    description: 'SteamID64 of bot to fetch the inventory from',
    example: '76561198120070906',
    type: String,
    required: false,
  })
  @IsSteamID()
  @IsOptional()
  @Transform((params) => new SteamID(params.value))
  bot?: SteamID;
}

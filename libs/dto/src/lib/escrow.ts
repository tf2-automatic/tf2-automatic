import { ApiProperty } from '@nestjs/swagger';
import { IsSteamID } from '@tf2-automatic/is-steamid-validator';
import { Transform } from 'class-transformer';
import { IsString, ValidateIf } from 'class-validator';
import SteamID from 'steamid';

export class GetEscrowDto {
  @ApiProperty({
    example: '76561198120070906',
    description: 'The SteamID64 of the bot you want to check the escrow for',
    type: String,
    required: false,
  })
  @IsSteamID()
  @Transform((params) => new SteamID(params.value))
  @ValidateIf((o) => !o.token)
  bot?: SteamID;

  @ApiProperty({
    example: '_Eq1Y3An',
    description: 'The trade offer token of the user',
    type: String,
    required: false,
  })
  @IsString()
  @ValidateIf((o) => !o.bot)
  token?: string;
}

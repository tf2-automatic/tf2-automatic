import { ApiProperty } from '@nestjs/swagger';
import { CreateTrade } from '@tf2-automatic/bot-data';
import { IsSteamID } from '@tf2-automatic/is-steamid-validator';
import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Asset } from './asset.dto';

export class CreateTradeDto implements CreateTrade {
  @ApiProperty({
    description: 'The steamid64 of the account to send the trade offer to',
    example: '76561198120070906',
  })
  @IsSteamID()
  partner: string;

  @ApiProperty({
    description: 'The token of the trade offer',
    example: '_Eq1Y3An',
    required: false,
  })
  @IsOptional()
  @IsString()
  token?: string;

  @ApiProperty({
    description: 'The message to send with the trade offer',
    example: 'Hello, I would like to trade with you',
    required: false,
  })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiProperty({
    description: 'The items to give',
    type: [Asset],
  })
  @IsArray()
  @ValidateNested({
    each: true,
  })
  @Type(() => Asset)
  itemsToGive: Asset[];

  @ApiProperty({
    description: 'The items to receive',
    type: [Asset],
  })
  @IsArray()
  @ValidateNested({
    each: true,
  })
  @Type(() => Asset)
  itemsToReceive: Asset[];
}

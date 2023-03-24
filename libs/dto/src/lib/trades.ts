import { ApiProperty } from '@nestjs/swagger';
import {
  Asset,
  CreateTrade,
  GetTrades,
  OfferFilter,
} from '@tf2-automatic/bot-data';
import { IsSteamID } from '@tf2-automatic/is-steamid-validator';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class AssetDto implements Asset {
  @ApiProperty({
    description: 'The assetid of the item',
    example: '1234567890',
  })
  @IsString()
  assetid: string;

  @ApiProperty({
    description: 'The appid of the item',
    example: 440,
  })
  @IsNumber()
  appid: number;

  @ApiProperty({
    description: 'The contextid of the item',
    example: '2',
  })
  @IsString()
  contextid: string;

  @ApiProperty({
    description: 'The amount of the item',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  amount?: number;
}

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
    type: [AssetDto],
  })
  @IsArray()
  @ValidateNested({
    each: true,
  })
  @Type(() => AssetDto)
  itemsToGive: Asset[];

  @ApiProperty({
    description: 'The items to receive',
    type: [AssetDto],
  })
  @IsArray()
  @ValidateNested({
    each: true,
  })
  @Type(() => AssetDto)
  itemsToReceive: Asset[];
}

export class GetTradesDto implements GetTrades {
  @ApiProperty({
    enum: OfferFilter,
    description: 'Filter the trades',
    example: OfferFilter.ActiveOnly,
  })
  @IsEnum(OfferFilter)
  @Type(() => Number)
  filter: OfferFilter;
}

import { ApiProperty } from '@nestjs/swagger';
import {
  Asset,
  CreateTrade,
  GetTrades,
  OfferFilter,
} from '@tf2-automatic/bot-data';
import { QueueTrade, RetryTradeOptions } from '@tf2-automatic/bot-manager-data';
import { IsSteamID } from '@tf2-automatic/is-steamid-validator';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
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

export class QueueTradeOptionsDto implements RetryTradeOptions {
  @ApiProperty({
    description:
      'The priority of the job. The closter to 1 the higher the priority.',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  priority?: number;

  retryStrategy?: 'exponential' | 'linear' | 'fixed';

  @ApiProperty({
    description:
      'Maximum amount of time in milliseconds the job will be retried for until it fails',
    example: 60000,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(10000)
  maxTime?: number;

  @ApiProperty({
    description: 'Delay between retries in milliseconds',
    example: 1000,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(1000)
  delay?: number;

  @ApiProperty({
    description: 'Maximum delay between retries in milliseconds',
    example: 10000,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(10000)
  maxDelay?: number;
}

export class QueueTradeDto implements QueueTrade {
  @ApiProperty({
    description: 'The trade to send',
    type: CreateTradeDto,
  })
  @ValidateNested()
  @Type(() => CreateTradeDto)
  trade: CreateTradeDto;

  @ApiProperty({
    description: 'The steamid64 of the bot to send the trade offer with',
    example: '76561198120070906',
  })
  @IsSteamID()
  bot: string;

  @ApiProperty({
    description:
      'The priority of the job. The closter to 1 the higher the priority.',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  priority?: number;

  @ApiProperty({
    description: 'The options for the job',
    type: QueueTradeOptionsDto,
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => QueueTradeOptionsDto)
  retry: QueueTradeOptionsDto;
}

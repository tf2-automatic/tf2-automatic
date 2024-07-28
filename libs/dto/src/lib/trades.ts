import { ValidationPipe } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import {
  Asset,
  CounterTrade,
  CreateTrade,
  GetTrades,
  OfferFilter,
} from '@tf2-automatic/bot-data';
import {
  ManagerCounterTrade,
  QueueTrade,
  QueueTradeJobData,
  QueueTradeType,
  QueueTradeTypes,
} from '@tf2-automatic/bot-manager-data';
import { IsSteamID } from '@tf2-automatic/is-steamid-validator';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  Validate,
  ValidateNested,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { QueueRetryDto } from './misc';

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

export class BaseCreateTrade {
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

export class CreateTradeDto extends BaseCreateTrade implements CreateTrade {
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
}

export class CounterTradeDto extends BaseCreateTrade implements CounterTrade {}

export class ManagerCounterTradeDto
  extends CounterTradeDto
  implements ManagerCounterTrade
{
  @ApiProperty({
    description: 'The id of the trade to counter',
    example: '1234567890',
  })
  @IsString()
  id: string;
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

@ValidatorConstraint()
export class TradeQueueDataValidator implements ValidatorConstraintInterface {
  validate(object: unknown, args: ValidationArguments) {
    const dto = args.object as TradeQueueJobDto;
    if (!QueueTradeTypes.includes(dto.type)) {
      return false;
    }

    switch (dto.type) {
      case 'CREATE':
        // Very hacky way to validate the data
        return new ValidationPipe()
          .transform(dto.data, {
            type: 'body',
            metatype: CreateTradeDto,
          })
          .then(() => true)
          .catch(() => {
            return false;
          });
      case 'COUNTER':
        return new ValidationPipe()
          .transform(dto.data, {
            type: 'body',
            metatype: ManagerCounterTradeDto,
          })
          .then(() => true)
          .catch(() => {
            return false;
          });
      case 'DELETE':
      case 'ACCEPT':
      case 'CONFIRM':
      case 'REFRESH':
        return typeof object === 'string';
      default:
        return false;
    }
  }

  defaultMessage(args: ValidationArguments) {
    // here you can provide default error message if validation failed
    const dto = args.object as TradeQueueJobDto;
    if (!QueueTradeTypes.includes(dto.type)) {
      return "data can't be validated because type is invalid";
    }

    switch (dto.type) {
      case 'CREATE':
        return 'data must be a valid CreateTradeDto';
      case 'COUNTER':
        return 'data must be a valid CounterTradeDto';
      case 'DELETE':
      case 'ACCEPT':
      case 'CONFIRM':
      case 'REFRESH':
        return 'data must be a string';
      default:
        return 'data is invalid';
    }
  }
}

export class TradeQueueJobDto implements QueueTrade {
  @ApiProperty({
    description: 'The type of the job',
    enum: QueueTradeTypes,
  })
  @IsIn(QueueTradeTypes)
  type: QueueTradeType;

  @ApiProperty({
    description: 'The data for the job',
  })
  @Validate(TradeQueueDataValidator)
  data: QueueTradeJobData;

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
    type: QueueRetryDto,
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => QueueRetryDto)
  retry?: QueueRetryDto;
}

export class GetExchangeDetailsDto {
  @ApiProperty({
    description: 'Get the details even if the trade failed',
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  @Transform((params) => params.value === 'true')
  getDetailsIfFailed = false;
}

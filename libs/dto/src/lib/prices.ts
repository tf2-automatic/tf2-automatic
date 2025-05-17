import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Min,
  registerDecorator,
  ValidateIf,
  ValidateNested,
  ValidationOptions,
} from 'class-validator';
import {
  PricelistAsset,
  PricesSearch,
  Pure,
  SavePrice,
} from '@tf2-automatic/item-service-data';
import { IsSteamID } from '@tf2-automatic/is-steamid-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PricelistAssetDto implements PricelistAsset {
  @ApiProperty({
    description: 'The SteamID64 of the account that owns the asset',
    example: '76561198120070906',
    required: true,
  })
  @IsSteamID()
  owner: string;

  @ApiProperty({
    description: 'The ID of the asset',
    example: '1234',
    required: true,
  })
  @IsString()
  id: string;
}

export class PureDto implements Pure {
  @ApiProperty({
    example: 0,
    required: true,
    minimum: 0,
    type: 'integer',
  })
  @IsInt()
  @Min(0)
  halfScrap: number;

  @ApiProperty({
    example: 0,
    required: true,
    minimum: 0,
    type: 'integer',
  })
  @IsInt()
  @Min(0)
  keys: number;
}

function AlwaysInvalid(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'alwaysInvalid',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate() {
          return false;
        },
        defaultMessage() {
          return 'invalid usage';
        },
      },
    });
  };
}

export class SavePriceDto implements SavePrice {
  @ApiProperty({
    description: 'The SKU of the item',
    example: '5021;6',
    required: true,
  })
  @IsString()
  sku: string;

  @ApiProperty({
    description: 'A specific asset to price',
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => PricelistAssetDto)
  asset?: PricelistAssetDto;

  @ApiProperty({
    description: 'A buy price',
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => PureDto)
  buy?: PureDto;

  @ApiProperty({
    description: 'A sell price',
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => PureDto)
  sell?: PureDto;

  @ValidateIf((o) => !o.buy && !o.sell)
  @AlwaysInvalid({ message: 'either buy or sell must be defined' })
  private readonly _atLeastOne: undefined;

  @ValidateIf(
    (o) =>
      o.buy &&
      o.sell &&
      (o.buy.halfScrap > o.sell.halfScrap || o.buy.keys > o.sell.keys),
  )
  @AlwaysInvalid({ message: 'sell must always be higher or equal buy' })
  private readonly badPrice: undefined;

  @ValidateIf((o) => o.buy && o.buy.keys === 0 && o.buy.halfScrap === 0)
  @AlwaysInvalid({ message: 'buy must be greater than 0' })
  private readonly buyZero: undefined;

  @ValidateIf((o) => o.sell && o.sell.keys === 0 && o.sell.halfScrap === 0)
  @AlwaysInvalid({ message: 'sell must be greater than 0' })
  private readonly sellZero: undefined;

  @ValidateIf(
    (o) =>
      o.buy &&
      o.sell &&
      o.buy.halfScrap === o.sell.halfScrap &&
      o.buy.keys === o.sell.keys,
  )
  @AlwaysInvalid({ message: 'buy and sell must be different' })
  private readonly buyEqualSell: undefined;
}

export class PricesSearchDto implements PricesSearch {
  @ApiProperty({
    description: 'The name of the item to search for',
    example: 'Mann Co. Supply Crate Key',
    required: true,
  })
  @IsString()
  name: string;
}

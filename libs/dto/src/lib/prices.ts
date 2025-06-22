import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  PricelistAsset,
  PricesSearch,
  Pure,
  SavePrice,
} from '@tf2-automatic/item-service-data';
import { IsSteamID } from '@tf2-automatic/is-steamid-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AlwaysInvalid, CursorPaginationDto, ItemModel } from './common';

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

export class SavePriceDto implements SavePrice {
  @ApiProperty({
    description: 'The item to price',
    required: false,
  })
  @IsOptional()
  @Type(() => ItemModel)
  @ValidateNested()
  item?: ItemModel;

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

  @ApiProperty({
    description: 'The minimum stock',
    required: false,
    type: 'integer',
    minimum: 0,
    example: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  min?: number;

  @ApiProperty({
    description: 'The maximum stock. -1 means no limit.',
    required: false,
    type: 'integer',
    minimum: -1,
    example: -1,
  })
  @IsOptional()
  @IsInt()
  @Min(-1)
  max?: number;

  @ValidateIf((o) => !o.item && !o.asset)
  @AlwaysInvalid({ message: 'either item or asset must be defined' })
  private readonly itemOrAsset: undefined;

  @ValidateIf((o) => o.asset && o.item)
  @AlwaysInvalid({ message: 'item must not be defined if asset is defined' })
  private readonly assetWithAsset: undefined;

  @ValidateIf((o) => !o.buy && !o.sell)
  @AlwaysInvalid({ message: 'either buy or sell must be defined' })
  private readonly atLeastOne: undefined;

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

  @ValidateIf(
    (o) =>
      o.min !== undefined &&
      o.max !== undefined &&
      o.min > o.max &&
      o.max !== -1,
  )
  @AlwaysInvalid({ message: 'max must be greater than or equal to min' })
  private readonly maxMin: undefined;

  @ValidateIf(
    (o) => o.min !== undefined && o.max !== undefined && o.asset !== undefined,
  )
  @AlwaysInvalid({
    message: 'min and max must not be defined when asset is defined',
  })
  private readonly assetMinMax: undefined;
}

export class PricesSearchDto
  extends CursorPaginationDto
  implements PricesSearch
{
  @ApiProperty({
    description: 'The name of the item to search for',
    example: 'Mann Co. Supply Crate Key',
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Type(() => String)
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return [value];
    }
    return value;
  })
  name?: string[];

  @ApiProperty({
    description: 'The sku of the item to search for',
    example: '5021;6',
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Type(() => String)
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return [value];
    }
    return value;
  })
  sku?: string[];

  @ApiProperty({
    description: 'The assetid of the item to search for',
    example: '1234567890',
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Type(() => String)
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return [value];
    }
    return value;
  })
  assetid?: string[];

  @ValidateIf((o) => (o.cursor || o.count) && (o.name || o.sku || o.assetid))
  @AlwaysInvalid({
    message:
      'cursor and count must not be defined if name, sku or assetid are defined',
  })
  private readonly cursorAndCount: undefined;
}

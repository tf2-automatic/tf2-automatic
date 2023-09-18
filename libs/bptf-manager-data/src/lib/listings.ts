import { ApiProperty } from '@nestjs/swagger';
import { IsRefined } from '@tf2-automatic/is-refined-validator';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class ListingCurrenciesDto {
  @IsInt()
  @ValidateIf(
    (o) =>
      o.keys !== undefined || (o.keys === undefined && o.metal === undefined),
  )
  keys?: number;

  @IsNumber()
  @IsRefined()
  @ValidateIf(
    (o) =>
      o.metal !== undefined || (o.keys === undefined && o.metal === undefined),
  )
  metal?: number;
}

export class ListingItemDto {
  @IsNumber()
  @IsOptional()
  quantity?: number;
}

export class ListingDto {
  @ApiProperty({
    description:
      'An item object of either the v1 or v2 format of the item you want to buy',
    example: {
      defindex: 5021,
      quality: 6,
    },
    required: false,
  })
  @IsObject()
  @Type(() => ListingItemDto)
  @ValidateNested()
  @ValidateIf((o) => o.id === undefined)
  item?: ListingItemDto;

  @ApiProperty({
    description: 'The assetid of the item you want to sell',
    example: '123456789',
    required: false,
  })
  @IsString()
  @ValidateIf((o) => o.item === undefined)
  id?: string;
}

export class AddListingDto extends ListingDto {
  @IsObject()
  @ValidateNested()
  @Type(() => ListingCurrenciesDto)
  currencies!: ListingCurrenciesDto;

  @IsOptional()
  @IsString()
  details?: string;
}

export class RemoveListingDto extends ListingDto {
  @IsObject()
  @ValidateIf((o) => o.id === undefined && o.hash === undefined)
  override item?: object;

  @IsString()
  @ValidateIf((o) => o.item === undefined && o.hash === undefined)
  override id?: string;

  @IsString()
  @ValidateIf((o) => o.id === undefined && o.item === undefined)
  hash?: string;
}

export class DesiredListingDto {
  @ApiProperty({
    description: 'The raw listing object to send to backpack.tf',
    example: {
      item: {
        defindex: 5021,
        quality: 6,
      },
      details: 'Buying keys for 50.11 refined!',
      currencies: {
        metal: 50.11,
      },
    },
    type: AddListingDto,
  })
  @IsObject()
  @Type(() => AddListingDto)
  @ValidateNested()
  listing!: AddListingDto;

  @ApiProperty({
    description:
      'The priority of the listing. The higher the number the lower the priority.',
    required: false,
    minimum: 1,
    maximum: Number.MAX_SAFE_INTEGER,
    example: 1,
  })
  @IsNumber()
  @IsOptional()
  priority?: number;

  @ApiProperty({
    description:
      'Whether or not if the listing should be forced to be created even if one is already active and no changes are made to the listing.',
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  force?: boolean;
}

export interface DesiredListing {
  hash: string;
  id: string | null;
  listing: ListingDto;
  priority?: number;
  error?: string;
  lastAttemptedAt?: number;
  updatedAt: number;
}

export class DesiredListingModel implements DesiredListing {
  @ApiProperty({
    description: 'A unique hash for the listing, used to identify it',
  })
  hash!: string;

  @ApiProperty({
    description: 'The id of the listing on backpack.tf if one is created',
    example: '123456789',
    nullable: true,
  })
  id!: string | null;

  @ApiProperty({
    description: 'The raw listing object to send to backpack.tf',
    type: ListingDto,
  })
  listing!: ListingDto;

  @ApiProperty({
    description:
      'The priority of the listing. The higher the number the lower the priority.',
    required: false,
    minimum: 1,
    maximum: Number.MAX_SAFE_INTEGER,
    example: 1,
  })
  priority?: number;

  @ApiProperty({
    description:
      'An error message indicating the error that occurred when the listing last failed to be created',
    required: false,
  })
  error?: string;

  @ApiProperty({
    description:
      'The timestamp of when the listing was last attempted to be created',
    required: false,
  })
  lastAttemptedAt?: number;

  @ApiProperty({
    description: 'The timestamp of when the desired listing was last updated',
  })
  updatedAt!: number;
}

export interface Listing {
  id: string;
  item: {
    quantity?: number;
  };
  archived: boolean;
  listedAt: number;
  bumpedAt: number;
  currencies: {
    keys?: number;
    metal?: number;
  };
  details?: string;
}

export interface ListingLimits {
  // How many listings can be created
  cap: number;
  // How many listings are currently created
  used: number;
  // How many listings can be promoted
  promoted: number;
  // When the limits were last updated
  updatedAt: number;
}

export class ListingLimitsModel implements ListingLimits {
  @ApiProperty({
    description: 'How many listings can be created',
  })
  cap!: number;

  @ApiProperty({
    description: 'How many listings are currently created',
  })
  used!: number;

  @ApiProperty({
    description: 'How many listings can be promoted',
  })
  promoted!: number;

  @ApiProperty({
    description: 'When the limits were last updated',
  })
  updatedAt!: number;
}

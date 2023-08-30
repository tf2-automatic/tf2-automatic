import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class ListingDto {
  @IsObject()
  @ValidateIf((o) => o.id === undefined)
  item?: object;

  @IsString()
  @ValidateIf((o) => o.item === undefined)
  id?: string;
}

export class DesiredListingDto {
  @IsObject()
  @Type(() => ListingDto)
  @ValidateNested()
  listing!: ListingDto;

  @IsNumber()
  @IsOptional()
  priority?: number;

  @IsBoolean()
  @IsOptional()
  force?: boolean;
}

export interface DesiredListing {
  id: string | null;
  listing: ListingDto;
  priority?: number;
  error?: string;
  lastAttemptedAt?: number;
  updatedAt: number;
}

export interface Listing {
  id: string;
  archived: boolean;
  listedAt: number;
  bumpedAt: number;
}

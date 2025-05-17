import {
  SchemaOptions,
  SchemaPaginated,
  SchemaSearch,
} from '@tf2-automatic/item-service-data';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDefined,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';

export class SchemaOptionsDto extends SchemaOptions {
  @IsInt()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  time?: number;

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  items_game = false;
}

export class SchemaPaginatedDto extends SchemaPaginated {
  @IsInt()
  @IsPositive()
  @IsOptional()
  @Type(() => Number)
  count = 1000;

  @IsOptional()
  @IsInt()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  cursor = 0;
}

export class SchemaSearchDto extends SchemaSearch {
  @IsString()
  @IsDefined()
  name: string;
}

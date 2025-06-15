import { SchemaOptions, SchemaSearch } from '@tf2-automatic/item-service-data';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDefined,
  IsInt,
  IsOptional,
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

export class SchemaSearchDto extends SchemaSearch {
  @IsString()
  @IsDefined()
  name: string;
}

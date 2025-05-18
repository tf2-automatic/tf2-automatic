import { ApiProperty } from '@nestjs/swagger';
import { CursorPagination } from '@tf2-automatic/common-data';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsPositive,
  Min,
  registerDecorator,
  ValidationOptions,
} from 'class-validator';

export class CursorPaginationDto implements CursorPagination {
  @IsInt()
  @IsPositive()
  @IsOptional()
  @Type(() => Number)
  count?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  cursor?: number;
}

export class CursorPaginationResponse<T> {
  @ApiProperty({
    description: 'The cursor used for the current request',
    example: 0,
  })
  current: number;

  @ApiProperty({
    description: 'The cursor to use for the next request',
    example: 1000,
  })
  next: number | null;

  @ApiProperty({
    isArray: true,
  })
  items: T[];
}

export function AlwaysInvalid(validationOptions?: ValidationOptions) {
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

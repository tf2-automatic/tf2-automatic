import { ApiProperty } from '@nestjs/swagger';
import { CursorPagination } from '@tf2-automatic/common-data';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsPositive,
  Min,
  registerDecorator,
  ValidationArguments,
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

export function IsBigIntGreaterThan(
  min: bigint,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isBigIntGreaterThan',
      target: object.constructor,
      propertyName: propertyName,
      constraints: [min],
      options: validationOptions,
      validator: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        validate(value: any, args: ValidationArguments) {
          try {
            const num = BigInt(value);
            return num > args.constraints[0];
          } catch {
            return false;
          }
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be a string representing a bigint greater than ${args.constraints[0]}`;
        },
      },
    });
  };
}

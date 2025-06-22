import { ApiProperty } from '@nestjs/swagger';
import { CursorPagination } from '@tf2-automatic/common-data';
import {
  NumberOrNull,
  RecipeInput,
  RequiredItemAttributes,
  Spell,
  Utils,
} from '@tf2-automatic/tf2-format';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDefined,
  IsIn,
  IsInt,
  IsOptional,
  IsPositive,
  Max,
  Min,
  registerDecorator,
  ValidateIf,
  ValidateNested,
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

const DEFAULT_ITEM = Utils.getDefault();

export class RecipeInputModel implements RecipeInput {
  @ApiProperty({
    required: false,
    example: DEFAULT_ITEM.defindex,
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  defindex?: number;

  @ApiProperty({
    required: false,
    example: DEFAULT_ITEM.killstreak,
  })
  @IsOptional()
  @IsIn([0, 1, 2, 3])
  @IsInt()
  killstreak?: number;

  @ApiProperty({
    required: true,
    example: DEFAULT_ITEM.quality,
  })
  @IsDefined()
  @IsInt()
  @IsPositive()
  quality: number;

  @ApiProperty({
    required: true,
    example: DEFAULT_ITEM.quantity,
  })
  @IsDefined()
  @IsInt()
  @IsPositive()
  quantity: number;
}

export class ItemModel implements RequiredItemAttributes {
  @ApiProperty({
    required: true,
    example: 5021,
  })
  @IsDefined()
  @IsInt()
  @IsPositive()
  defindex: number;

  @ApiProperty({
    required: true,
    example: 6,
  })
  @IsDefined()
  @IsInt()
  @IsPositive()
  quality: number;

  @ApiProperty({
    required: false,
    example: DEFAULT_ITEM.craftable,
  })
  @IsOptional()
  @IsBoolean()
  craftable?: boolean;

  @ApiProperty({
    required: false,
    example: DEFAULT_ITEM.tradable,
  })
  @IsOptional()
  @IsBoolean()
  tradable?: boolean;

  @ApiProperty({
    required: false,
    example: DEFAULT_ITEM.australium,
  })
  @IsOptional()
  @IsBoolean()
  australium?: boolean;

  @ApiProperty({
    required: false,
    example: DEFAULT_ITEM.festivized,
  })
  @IsOptional()
  @IsBoolean()
  festivized?: boolean;

  @ApiProperty({
    required: false,
    example: DEFAULT_ITEM.effect,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @ValidateIf((_, v) => v !== null)
  effect?: NumberOrNull;

  @ApiProperty({
    required: false,
    example: DEFAULT_ITEM.wear,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  @ValidateIf((_, v) => v !== null)
  wear?: NumberOrNull;

  @ApiProperty({
    required: false,
    example: DEFAULT_ITEM.paintkit,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @ValidateIf((_, v) => v !== null)
  paintkit?: NumberOrNull;

  @ApiProperty({
    required: false,
    example: DEFAULT_ITEM.killstreak,
  })
  @IsOptional()
  @IsIn([0, 1, 2, 3])
  @IsInt()
  killstreak?: number;

  @ApiProperty({
    required: false,
    example: DEFAULT_ITEM.target,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @ValidateIf((_, v) => v !== null)
  target?: NumberOrNull;

  @ApiProperty({
    required: false,
    example: DEFAULT_ITEM.output,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @ValidateIf((_, v) => v !== null)
  output?: NumberOrNull;

  @ApiProperty({
    required: false,
    example: DEFAULT_ITEM.outputQuality,
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  @ValidateIf((_, v) => v !== null)
  outputQuality?: NumberOrNull;

  @ApiProperty({
    required: false,
    example: DEFAULT_ITEM.elevated,
  })
  @IsOptional()
  @IsBoolean()
  elevated?: boolean;

  @ApiProperty({
    required: false,
    example: DEFAULT_ITEM.crateSeries,
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  @ValidateIf((_, v) => v !== null)
  crateSeries?: NumberOrNull;

  @ApiProperty({
    required: false,
    example: DEFAULT_ITEM.paint,
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  @ValidateIf((_, v) => v !== null)
  paint?: NumberOrNull;

  @ApiProperty({
    required: false,
    example: DEFAULT_ITEM.parts,
  })
  @IsOptional()
  @IsInt({ each: true })
  @IsArray()
  parts?: number[];

  @ApiProperty({
    required: false,
    example: DEFAULT_ITEM.spells,
  })
  @IsOptional()
  @IsTupleOfTwoNumbers({ each: true })
  @IsArray()
  spells?: Spell[];

  @ApiProperty({
    required: false,
    example: DEFAULT_ITEM.sheen,
  })
  @IsOptional()
  @IsPositive()
  @IsInt()
  @ValidateIf((_, v) => v !== null)
  sheen?: NumberOrNull;

  @ApiProperty({
    required: false,
    example: DEFAULT_ITEM.killstreaker,
  })
  @IsOptional()
  @IsPositive()
  @IsInt()
  @ValidateIf((_, v) => v !== null)
  killstreaker?: NumberOrNull;

  @ApiProperty({
    required: false,
    type: [RecipeInputModel],
    example: DEFAULT_ITEM.inputs,
  })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => RecipeInputModel)
  @ValidateIf((_, v) => v !== null)
  inputs?: RecipeInputModel[] | null;

  @ApiProperty({
    required: false,
    example: DEFAULT_ITEM.quantity,
  })
  @IsOptional()
  @IsPositive()
  @IsInt()
  quantity?: number;
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

export function IsTupleOfTwoNumbers(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isTupleOfTwoNumbers',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        validate(value: any) {
          return (
            Array.isArray(value) &&
            value.length === 2 &&
            typeof value[0] === 'number' &&
            typeof value[1] === 'number'
          );
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be a tuple of two numbers`;
        },
      },
    });
  };
}

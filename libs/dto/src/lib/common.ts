import { ApiProperty } from '@nestjs/swagger';
import { CursorPagination } from '@tf2-automatic/common-data';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsPositive, Min } from 'class-validator';

export class CursorPaginationDto extends CursorPagination {
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

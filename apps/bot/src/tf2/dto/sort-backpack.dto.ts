import { ApiProperty } from '@nestjs/swagger';
import { SortBackpack, SortBackpackTypes } from '@tf2-automatic/bot-data';
import { IsEnum } from 'class-validator';

export class SortBackpackDto implements SortBackpack {
  @ApiProperty({
    enum: SortBackpackTypes,
    description: 'The type of sorting to use',
  })
  @IsEnum(SortBackpackTypes)
  sort: SortBackpackTypes;
}

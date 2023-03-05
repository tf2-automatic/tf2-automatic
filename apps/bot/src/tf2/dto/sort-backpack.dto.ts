import { SortBackpack, SortBackpackTypes } from '@tf2-automatic/bot-data';
import { IsEnum } from 'class-validator';

export class SortBackpackDto implements SortBackpack {
  @IsEnum(SortBackpackTypes)
  sort: SortBackpackTypes;
}

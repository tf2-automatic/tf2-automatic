import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsOptional,
  ValidateIf,
} from 'class-validator';

export class NotificationsClearDto {
  @ApiProperty({
    description: 'Clear all notifications',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  clearAll = false;

  @ApiProperty({
    description: 'The notification ids',
    required: false,
  })
  @ValidateIf((dto) => dto.clearAll !== true)
  @IsArray()
  @ArrayNotEmpty()
  ids: Array<string | number>;
}

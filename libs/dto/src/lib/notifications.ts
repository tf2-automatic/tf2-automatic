import { ApiProperty } from '@nestjs/swagger';
import { NotificationsRead } from '@tf2-automatic/bot-data';
import {
  ArrayNotEmpty,
  Equals,
  IsArray,
  IsString,
  ValidateIf,
} from 'class-validator';
import { AlwaysInvalid } from './common';

export class NotificationsReadDto implements NotificationsRead {
  @ApiProperty({
    description: 'The ids of the notifications to mark as read',
    required: false,
    type: [String],
  })
  @ValidateIf((o) => o.ids !== undefined)
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  ids?: string[];

  @ApiProperty({
    description: 'Mark all notifications as read',
    required: false,
    enum: [true],
  })
  @ValidateIf((o) => o.all !== undefined)
  @Equals(true)
  all?: true;

  @ValidateIf((o) => o.ids === undefined && o.all === undefined)
  @AlwaysInvalid({ message: 'either ids or all must be defined' })
  private readonly idsOrAll: undefined;

  @ValidateIf((o) => o.ids !== undefined && o.all !== undefined)
  @AlwaysInvalid({ message: 'ids must not be defined if all is defined' })
  private readonly idsWithAll: undefined;
}

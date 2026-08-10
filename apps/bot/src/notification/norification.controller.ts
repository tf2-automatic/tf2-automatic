import { Body, Controller, Delete, ValidationPipe } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  NOTIFICATION_BASE_URL,
  NOTIFICATION_CLEAR_PATH,
} from '@tf2-automatic/bot-data';
import { NotificationsClearDto } from '@tf2-automatic/dto';
import { NotificationService } from './notification.service';

@ApiTags('Notification')
@Controller(NOTIFICATION_BASE_URL)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Delete(NOTIFICATION_CLEAR_PATH)
  @ApiOperation({
    summary: 'Clear notifications',
    description: 'Clear the steam notifications',
  })
  @ApiBody({
    type: NotificationsClearDto,
  })
  setAvatar(@Body(new ValidationPipe()) dto: NotificationsClearDto): void {
    return this.notificationService.clearNotification(dto);
  }
}

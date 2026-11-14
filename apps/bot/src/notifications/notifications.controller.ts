import { Body, Controller, Post, ValidationPipe } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  NOTIFICATIONS_BASE_URL,
  NOTIFICATIONS_READ_PATH,
} from '@tf2-automatic/bot-data';
import { NotificationsReadDto } from '@tf2-automatic/dto';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@Controller(NOTIFICATIONS_BASE_URL)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post(NOTIFICATIONS_READ_PATH)
  @ApiOperation({
    summary: 'Mark notifications as read',
    description: 'Mark specific or all Steam notifications as read',
  })
  @ApiBody({
    type: NotificationsReadDto,
  })
  markRead(@Body(new ValidationPipe()) dto: NotificationsReadDto): void {
    this.notificationsService.markRead(dto);
  }
}

import { Controller, Get, Param, Post } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiParamSteamID } from '@tf2-automatic/swagger';
import { ParseSteamIDPipe } from '@tf2-automatic/nestjs-steamid-pipe';
import SteamID from 'steamid';
import {
  NOTIFICATIONS_BASE_URL,
  NOTIFICATIONS_PATH,
  NOTIFICATIONS_REFRESH_PATH,
  NotificationModel,
} from '@tf2-automatic/bptf-manager-data';

@ApiTags('Notifications')
@Controller(NOTIFICATIONS_BASE_URL)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @ApiOperation({
    summary: 'Get notifications',
    description: 'Get all notifications from the database',
  })
  @ApiResponse({
    type: [NotificationModel],
  })
  @ApiParamSteamID()
  @Get(NOTIFICATIONS_PATH)
  getNotifications(
    @Param('steamid', ParseSteamIDPipe) steamid: SteamID,
  ): Promise<NotificationModel[]> {
    return this.notificationsService.getNotifications(steamid);
  }

  @ApiOperation({
    summary: 'Refresh notifications',
    description: 'Requests notifications to be refreshed from backpack.tf',
  })
  @ApiParamSteamID()
  @Post(NOTIFICATIONS_REFRESH_PATH)
  refreshNotifications(
    @Param('steamid', ParseSteamIDPipe) steamid: SteamID,
  ): Promise<void> {
    return this.notificationsService.refreshNotifications(steamid);
  }
}

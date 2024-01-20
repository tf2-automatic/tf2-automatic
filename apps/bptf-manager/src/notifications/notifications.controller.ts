import { Controller, Get, Param, Post } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiParamSteamID } from '@tf2-automatic/swagger';
import { ParseSteamIDPipe } from '@tf2-automatic/nestjs-steamid-pipe';
import SteamID from 'steamid';
import { Notification } from '@tf2-automatic/bptf-manager-data';

@ApiTags('Notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @ApiOperation({
    summary: 'Get notifications',
    description: 'Get all notifications from the database',
  })
  @ApiParamSteamID()
  @Get('/:steamid')
  getNotifications(
    @Param('steamid', ParseSteamIDPipe) steamid: SteamID,
  ): Promise<Notification[]> {
    return this.notificationsService.getNotifications(steamid);
  }

  @ApiOperation({
    summary: 'Refresh notifications',
    description: 'Requests notifications to be refreshed from backpack.tf',
  })
  @ApiParamSteamID()
  @Post('/:steamid/refresh')
  refreshNotifications(
    @Param('steamid', ParseSteamIDPipe) steamid: SteamID,
  ): Promise<void> {
    return this.notificationsService.refreshNotifications(steamid);
  }
}

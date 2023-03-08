import { Controller, ValidationPipe } from '@nestjs/common';

import { Post } from '@nestjs/common';
import { Param } from '@nestjs/common';
import { HttpCode } from '@nestjs/common';
import { Delete } from '@nestjs/common';
import { Body } from '@nestjs/common';
import {
  HEARTBEAT_BASE_URL,
  HEARTBEAT_PATH,
} from '@tf2-automatic/bot-manager-data';
import { ParseSteamIDPipe } from '@tf2-automatic/nestjs-steamid-pipe';
import SteamID from 'steamid';
import { BotHeartbeatDto } from './dto/bot-heartbeat.dto';
import { HeartbeatsService } from './heartbeats.service';

@Controller(HEARTBEAT_BASE_URL)
export class HeartbeatsController {
  constructor(private readonly heartbeatsService: HeartbeatsService) {}

  @Post(HEARTBEAT_PATH)
  @HttpCode(200)
  handleHeartbeat(
    @Param('steamid', ParseSteamIDPipe) steamid: SteamID,
    @Body(ValidationPipe) heartbeat: BotHeartbeatDto
  ) {
    return this.heartbeatsService.saveBot(steamid, heartbeat);
  }

  @Delete(HEARTBEAT_PATH)
  handleDelete(@Param('steamid', ParseSteamIDPipe) steamid: SteamID) {
    return this.heartbeatsService.deleteBot(steamid);
  }
}

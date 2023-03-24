import { Controller, ValidationPipe } from '@nestjs/common';

import { Post } from '@nestjs/common';
import { Param } from '@nestjs/common';
import { HttpCode } from '@nestjs/common';
import { Delete } from '@nestjs/common';
import { Body } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  HEARTBEAT_BASE_URL,
  HEARTBEAT_PATH,
} from '@tf2-automatic/bot-manager-data';
import { ParseSteamIDPipe } from '@tf2-automatic/nestjs-steamid-pipe';
import { ApiParamSteamID, BotModel } from '@tf2-automatic/swagger';
import SteamID from 'steamid';
import { BotHeartbeatDto } from '@tf2-automatic/dto';
import { HeartbeatsService } from './heartbeats.service';

@ApiTags('Heartbeats')
@Controller(HEARTBEAT_BASE_URL)
export class HeartbeatsController {
  constructor(private readonly heartbeatsService: HeartbeatsService) {}

  @Post(HEARTBEAT_PATH)
  @HttpCode(200)
  @ApiOperation({
    summary: 'Send heartbeat',
    description: 'Send a heartbeat to the bot manager.',
  })
  @ApiOkResponse({
    description: 'Heartbeat received',
    type: BotModel,
  })
  @ApiParamSteamID('SteamID64 of the bot sending the heartbeat')
  handleHeartbeat(
    @Param('steamid', ParseSteamIDPipe) steamid: SteamID,
    @Body(ValidationPipe) heartbeat: BotHeartbeatDto
  ) {
    return this.heartbeatsService.saveBot(steamid, heartbeat);
  }

  @Delete(HEARTBEAT_PATH)
  @ApiOperation({
    summary: 'Delete bot',
    description: 'Delete a bot from the bot manager.',
  })
  @ApiOkResponse({
    description: 'Bot deleted',
  })
  handleDelete(@Param('steamid', ParseSteamIDPipe) steamid: SteamID) {
    return this.heartbeatsService.deleteBot(steamid);
  }
}

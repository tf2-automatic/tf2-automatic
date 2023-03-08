import { Controller, ValidationPipe } from '@nestjs/common';
import { Post } from '@nestjs/common';
import { Param } from '@nestjs/common';
import { Get, HttpCode } from '@nestjs/common';
import { Delete } from '@nestjs/common';
import { Body } from '@nestjs/common';
import {
  BOTS_PATH,
  BOT_BASE_URL,
  BOT_HEARTBEAT_PATH,
  BOT_PATH,
} from '@tf2-automatic/bot-manager-data';
import { ParseSteamIDPipe } from '@tf2-automatic/nestjs-steamid-pipe';
import SteamID from 'steamid';
import { BotsService } from './bots.service';
import { BotHeartbeatDto } from './dto/bot-heartbeat.dto';

@Controller(BOT_BASE_URL)
export class BotsController {
  constructor(private readonly botsService: BotsService) {}

  @Post(BOT_HEARTBEAT_PATH)
  @HttpCode(200)
  handleHeartbeat(
    @Param('steamid', ParseSteamIDPipe) steamid: SteamID,
    @Body(ValidationPipe) heartbeat: BotHeartbeatDto
  ) {
    return this.botsService.saveBot(steamid, heartbeat);
  }

  @Delete(BOT_PATH)
  handleDelete(@Param('steamid', ParseSteamIDPipe) steamid: SteamID) {
    return this.botsService.deleteBot(steamid);
  }

  @Get(BOT_PATH)
  getBot(@Param('steamid', ParseSteamIDPipe) steamid: SteamID) {
    return this.botsService.getBot(steamid);
  }

  @Get(BOTS_PATH)
  getBots() {
    return this.botsService.getBots();
  }
}

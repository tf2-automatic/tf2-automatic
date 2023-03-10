import { Controller } from '@nestjs/common';
import { Param } from '@nestjs/common';
import { Get } from '@nestjs/common';
import {
  BOTS_PATH,
  BOT_BASE_URL,
  BOT_PATH,
} from '@tf2-automatic/bot-manager-data';
import { ParseSteamIDPipe } from '@tf2-automatic/nestjs-steamid-pipe';
import SteamID from 'steamid';
import { BotsService } from './bots.service';

@Controller(BOT_BASE_URL)
export class BotsController {
  constructor(private readonly botsService: BotsService) {}

  @Get(BOT_PATH)
  getBot(@Param('steamid', ParseSteamIDPipe) steamid: SteamID) {
    return this.botsService.getBot(steamid);
  }

  @Get(BOTS_PATH)
  getBots() {
    return this.botsService.getBots();
  }
}

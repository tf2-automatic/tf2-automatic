import { Controller } from '@nestjs/common';
import { Param } from '@nestjs/common';
import { Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  BOTS_PATH,
  BOT_BASE_URL,
  BOT_PATH,
} from '@tf2-automatic/bot-manager-data';
import { ParseSteamIDPipe } from '@tf2-automatic/nestjs-steamid-pipe';
import { ApiParamSteamID, BotModel } from '@tf2-automatic/swagger';
import SteamID from 'steamid';
import { BotsService } from './bots.service';

@ApiTags('Bots')
@Controller(BOT_BASE_URL)
export class BotsController {
  constructor(private readonly botsService: BotsService) {}

  @Get(BOT_PATH)
  @ApiOperation({
    summary: 'Get bot',
    description: 'Get a bot from the bot manager.',
  })
  @ApiParamSteamID('SteamID64 of the bot')
  @ApiOkResponse({
    description: 'Bot found',
    type: BotModel,
  })
  getBot(@Param('steamid', ParseSteamIDPipe) steamid: SteamID) {
    return this.botsService.getBot(steamid);
  }

  @Get(BOTS_PATH)
  @ApiOperation({
    summary: 'Get bots',
    description: 'Get all bots from the bot manager.',
  })
  @ApiOkResponse({
    description: 'List of bots',
    type: [BotModel],
  })
  getBots() {
    return this.botsService.getBots();
  }
}

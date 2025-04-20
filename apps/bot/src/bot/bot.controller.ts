import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  Bot,
  BOT_BASE_URL,
  BOT_WEBSESSION_PATH,
  BOT_PATH,
  BotWebSession,
} from '@tf2-automatic/bot-data';
import { BotService } from './bot.service';

@ApiTags('Bot')
@Controller(BOT_BASE_URL)
export class BotController {
  constructor(private readonly botService: BotService) {}

  @Get(BOT_PATH)
  @ApiOperation({
    summary: 'Get bot information',
    description: 'Get information about the bot, such as the steamid64.',
  })
  async getBot(): Promise<Bot> {
    return this.botService.getBot();
  }

  @Get(BOT_WEBSESSION_PATH)
  @ApiOperation({
    summary: 'Get bot web session',
    description: "Get the bot's web session which contains the cookies.",
  })
  async getWebSession(): Promise<BotWebSession> {
    return this.botService.getWebSession();
  }
}

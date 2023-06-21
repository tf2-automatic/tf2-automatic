import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Bot, BOT_BASE_URL, BOT_PATH } from '@tf2-automatic/bot-data';
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
}

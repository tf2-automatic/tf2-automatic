import { Controller, Get } from '@nestjs/common';
import { Bot, BOT_BASE_URL, BOT_PATH } from '@tf2-automatic/bot-data';
import { BotService } from './bot.service';

@Controller(BOT_BASE_URL)
export class BotController {
  constructor(private readonly botService: BotService) {}

  @Get(BOT_PATH)
  async getBot(): Promise<Bot> {
    const steamid64 = this.botService.getSteamID64();

    return {
      steamid64,
    };
  }
}

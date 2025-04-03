import { Bot as ManagerBot } from '@tf2-automatic/bot-manager-data';
import { Bot, BOT_FULL_PATH } from '@tf2-automatic/bot-data';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Injectable, NotFoundException } from '@nestjs/common';
import { ManagerService } from '../manager/manager.service';

@Injectable()
export class BotsService {
  constructor(
    private readonly httpService: HttpService,
    private readonly managerService: ManagerService,
  ) {}

  async getApiKey(): Promise<string> {
    const bots = await this.managerService.getRunningBots();

    if (bots.length === 0) {
      throw new NotFoundException('No bots found');
    }

    const index = Math.floor(Math.random() * bots.length);
    const bot = bots[index];

    const info = await this.getBot(bots[0]);

    if (bot.steamid64 !== info.steamid64) {
      throw new NotFoundException('Bot not found');
    }

    return info.apiKey;
  }

  async getBot(bot: ManagerBot): Promise<Bot> {
    const url = this.getBotUrl(bot, BOT_FULL_PATH);

    const response = await firstValueFrom(this.httpService.get<Bot>(url));

    return response.data;
  }

  private getBotUrl(bot: ManagerBot, path: string): string {
    return `http://${bot.ip}:${bot.port}${path}`;
  }
}

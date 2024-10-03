import {
  Bot as ManagerBot,
  BOTS_FULL_PATH,
} from '@tf2-automatic/bot-manager-data';
import { Bot, BOT_FULL_PATH } from '@tf2-automatic/bot-data';
import { ConfigService } from '@nestjs/config';
import { Config } from '../common/config/configuration';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Injectable, NotFoundException } from '@nestjs/common';

@Injectable()
export class BotsService {
  private managerUrl = this.configService.getOrThrow('manager').url;

  constructor(
    private readonly configService: ConfigService<Config>,
    private readonly httpService: HttpService,
  ) {}

  async getApiKey(): Promise<string> {
    const bots = await this.getRunningBots();

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

  async getRunningBots(): Promise<ManagerBot[]> {
    const bots = await this.getBots();
    return bots.filter((bot) => bot.running === true);
  }

  async getBots(): Promise<ManagerBot[]> {
    const url = this.getManagerUrl(BOTS_FULL_PATH);

    const response = await firstValueFrom(
      this.httpService.get<ManagerBot[]>(url),
    );

    return response.data;
  }

  async getBot(bot: ManagerBot): Promise<Bot> {
    const url = this.getBotUrl(bot, BOT_FULL_PATH);

    const response = await firstValueFrom(this.httpService.get<Bot>(url));

    return response.data;
  }

  private getManagerUrl(path: string): string {
    return `${this.managerUrl}${path}`;
  }

  private getBotUrl(bot: ManagerBot, path: string): string {
    return `http://${bot.ip}:${bot.port}${path}`;
  }
}

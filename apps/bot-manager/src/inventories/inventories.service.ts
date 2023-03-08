import { HttpService } from '@nestjs/axios';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import {
  INVENTORIES_BASE_URL,
  Inventory,
  INVENTORY_PATH,
} from '@tf2-automatic/bot-data';
import { Bot } from '@tf2-automatic/bot-manager-data';
import { firstValueFrom } from 'rxjs';
import SteamID from 'steamid';
import { HeartbeatsService } from '../heartbeats/heartbeats.service';

@Injectable()
export class InventoriesService {
  constructor(
    private readonly httpService: HttpService,
    private readonly heartbeatsService: HeartbeatsService
  ) {}

  async getInventoryFromBot(
    bot: Bot,
    steamid: SteamID,
    appid: number,
    contextid: string
  ): Promise<Inventory> {
    const response = await firstValueFrom(
      this.httpService.get<Inventory>(
        `http://${bot.ip}:${bot.port}${INVENTORIES_BASE_URL}${INVENTORY_PATH}`
          .replace(':steamid', steamid.getSteamID64())
          .replace(':appid', appid.toString())
          .replace(':contextid', contextid)
      )
    );

    return response.data;
  }

  async getInventory(
    steamid: SteamID,
    appid: number,
    contextid: string
  ): Promise<Inventory> {
    // If the client wants non-cached data then fetch it, store it, and return it
    const bots = await this.heartbeatsService.getBots();

    if (bots.length === 0) {
      throw new ServiceUnavailableException('No bots available');
    }

    // Choose a random bot
    const bot = bots[Math.floor(Math.random() * bots.length)];

    // Get the inventory of the bot
    return this.getInventoryFromBot(bot, steamid, appid, contextid);
  }
}

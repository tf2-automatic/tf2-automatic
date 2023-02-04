import { Injectable } from '@nestjs/common';
import { BotService } from '../bot/bot.service';
import SteamTradeOfferManager from 'steam-tradeoffer-manager';
import SteamID from 'steamid';
import { Inventory } from '@tf2-automatic/bot-data';

@Injectable()
export class InventoriesService {
  private readonly manager: SteamTradeOfferManager =
    this.botService.getManager();

  constructor(private readonly botService: BotService) {}

  async getInventory(
    steamid: SteamID,
    appid: number,
    contextid: number
  ): Promise<Inventory> {
    return new Promise((resolve, reject) => {
      const callback = (err: Error, inventory: Inventory) => {
        if (err) {
          reject(err);
        } else {
          resolve(inventory);
        }
      };

      if (steamid.getSteamID64() === this.botService.getSteamID64()) {
        this.manager.getInventoryContents(appid, contextid, true, callback);
      } else {
        this.manager.getUserInventoryContents(
          steamid,
          appid,
          contextid,
          true,
          callback
        );
      }
    });
  }
}

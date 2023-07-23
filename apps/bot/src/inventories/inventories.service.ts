import { Injectable, Logger } from '@nestjs/common';
import { BotService } from '../bot/bot.service';
import SteamTradeOfferManager from 'steam-tradeoffer-manager';
import SteamID from 'steamid';
import { Inventory } from '@tf2-automatic/bot-data';

@Injectable()
export class InventoriesService {
  private readonly logger = new Logger(InventoriesService.name);

  private readonly manager: SteamTradeOfferManager =
    this.botService.getManager();

  constructor(private readonly botService: BotService) {}

  async getInventory(
    steamid: SteamID,
    appid: number,
    contextid: number,
    tradableOnly = true
  ): Promise<Inventory> {
    return new Promise((resolve, reject) => {
      this.logger.debug(
        `Getting inventory ${steamid}/${appid}/${contextid}?tradableOnly=${tradableOnly}...`
      );

      const callback = (err: Error, inventory: Inventory) => {
        if (err) {
          this.logger.warn(`Error getting inventory: ${err.message}`);
          reject(err);
        } else {
          this.logger.debug(
            `Got inventory ${steamid}/${appid}/${contextid} with ${inventory.length} items`
          );
          resolve(inventory);
        }
      };

      if (steamid.getSteamID64() === this.botService.getSteamID64()) {
        this.manager.getInventoryContents(
          appid,
          contextid,
          tradableOnly,
          callback
        );
      } else {
        this.manager.getUserInventoryContents(
          steamid,
          appid,
          contextid,
          tradableOnly,
          callback
        );
      }
    });
  }
}

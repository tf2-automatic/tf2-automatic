import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { BotService } from '../bot/bot.service';
import { InventoryCallback } from 'steam-tradeoffer-manager';
import SteamID from 'steamid';
import { Inventory } from '@tf2-automatic/bot-data';

@Injectable()
export class InventoriesService {
  private readonly logger = new Logger(InventoriesService.name);

  private readonly manager = this.botService.getManager();

  constructor(private readonly botService: BotService) {}

  async getInventory(
    steamid: SteamID,
    appid: number,
    contextid: number,
    tradableOnly = true,
  ): Promise<Inventory> {
    return new Promise((resolve, reject) => {
      this.logger.debug(
        `Getting inventory ${steamid}/${appid}/${contextid}?tradableOnly=${tradableOnly}...`,
      );

      const callback: InventoryCallback = (err, items) => {
        const inventory = items as unknown as Inventory;

        if (err) {
          if (err.message === 'HTTP error 401') {
            this.logger.warn(
              `Error getting inventory: ${err.message} (inventory is private)`,
            );
            return reject(new UnauthorizedException('Inventory is private'));
          }

          this.logger.warn(`Error getting inventory: ${err.message}`);
          return reject(err);
        }

        this.logger.debug(
          `Got inventory ${steamid}/${appid}/${contextid} with ${inventory.length} items`,
        );
        resolve(inventory);
      };

      if (steamid.getSteamID64() === this.botService.getSteamID64()) {
        this.manager.getInventoryContents(
          appid,
          contextid,
          tradableOnly,
          callback,
        );
      } else {
        this.manager.getUserInventoryContents(
          steamid,
          appid,
          contextid,
          tradableOnly,
          callback,
        );
      }
    });
  }
}

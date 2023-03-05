import { Controller, Get, Param } from '@nestjs/common';
import { InventoriesService } from './inventories.service';
import { INVENTORIES_BASE_URL, INVENTORY_PATH } from '@tf2-automatic/bot-data';
import { ParseSteamIDPipe } from '@tf2-automatic/nestjs-steamid-pipe';
import SteamID from 'steamid';

@Controller(INVENTORIES_BASE_URL)
export class InventoriesController {
  constructor(private readonly inventoriesService: InventoriesService) {}

  @Get(INVENTORY_PATH)
  getInventory(
    @Param('steamid', new ParseSteamIDPipe()) steamid: SteamID,
    @Param('appid') appid: number,
    @Param('contextid') contextid: number
  ) {
    return this.inventoriesService.getInventory(steamid, appid, contextid);
  }
}

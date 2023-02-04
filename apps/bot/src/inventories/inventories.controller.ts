import { Controller, Get, Param } from '@nestjs/common';
import { InventoriesService } from './inventories.service';
import { getInventoryPath, inventoriesBaseUrl } from '@tf2-automatic/bot-data';
import { ParseSteamIDPipe } from '@tf2-automatic/nestjs-steamid-pipe';
import SteamID from 'steamid';

@Controller(inventoriesBaseUrl)
export class InventoriesController {
  constructor(private readonly inventoriesService: InventoriesService) {}

  @Get(getInventoryPath)
  getInventory(
    @Param('steamid', new ParseSteamIDPipe()) steamid: SteamID,
    @Param('appid') appid: number,
    @Param('contextid') contextid: number
  ) {
    return this.inventoriesService.getInventory(steamid, appid, contextid);
  }
}

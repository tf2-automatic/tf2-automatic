import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { Inventory } from '@tf2-automatic/bot-data';
import {
  INVENTORIES_BASE_URL,
  INVENTORY_PATH,
} from '@tf2-automatic/bot-manager-data';
import { ParseSteamIDPipe } from '@tf2-automatic/nestjs-steamid-pipe';
import SteamID from 'steamid';
import { InventoriesService } from './inventories.service';

@Controller(INVENTORIES_BASE_URL)
export class InventoriesController {
  constructor(private readonly inventoriesService: InventoriesService) {}

  @Get(INVENTORY_PATH)
  getInventory(
    @Param('steamid', ParseSteamIDPipe) steamid: SteamID,
    @Param('appid', ParseIntPipe) appid: number,
    @Param('contextid') contextid: string
  ): Promise<Inventory> {
    return this.inventoriesService.getInventory(steamid, appid, contextid);
  }
}

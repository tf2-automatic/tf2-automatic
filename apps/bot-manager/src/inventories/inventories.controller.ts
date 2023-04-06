import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import {
  INVENTORIES_BASE_URL,
  InventoryResponse,
  INVENTORY_PATH,
} from '@tf2-automatic/bot-manager-data';
import { ParseSteamIDPipe } from '@tf2-automatic/nestjs-steamid-pipe';
import SteamID from 'steamid';
import { EnqueueInventoryDto } from '@tf2-automatic/dto';
import { InventoriesService } from './inventories.service';
import { ApiParamSteamID, CachedInventoryModel } from '@tf2-automatic/swagger';

@ApiTags('Inventories')
@Controller(INVENTORIES_BASE_URL)
export class InventoriesController {
  constructor(private readonly inventoriesService: InventoriesService) {}

  @Post(INVENTORY_PATH)
  @ApiOperation({
    summary: 'Add inventory to queue',
    description: 'Adds an inventory load job to the queue.',
  })
  @ApiParamSteamID()
  @ApiParam({
    name: 'appid',
    description: 'The appid of the game',
    example: 440,
  })
  @ApiParam({
    name: 'contextid',
    description: 'The contextid of the inventory',
    example: 2,
  })
  addInventoryToQueue(
    @Param('steamid', ParseSteamIDPipe) steamid: SteamID,
    @Param('appid', ParseIntPipe) appid: number,
    @Param('contextid') contextid: string,
    @Body(new ValidationPipe()) body: EnqueueInventoryDto
  ): Promise<void> {
    return this.inventoriesService.addToQueue(steamid, appid, contextid, body);
  }

  @Get(INVENTORY_PATH)
  @ApiOperation({
    summary: 'Get inventory',
    description:
      'Get the inventory of a Steam account. Saves and gets inventories to and from cache.',
  })
  @ApiOkResponse({
    description: 'Inventory',
    type: CachedInventoryModel,
  })
  @ApiParamSteamID()
  @ApiParam({
    name: 'appid',
    description: 'The appid of the game',
    example: 440,
  })
  @ApiParam({
    name: 'contextid',
    description: 'The contextid of the inventory',
    example: 2,
  })
  async getInventory(
    @Param('steamid', ParseSteamIDPipe) steamid: SteamID,
    @Param('appid', ParseIntPipe) appid: number,
    @Param('contextid') contextid: string
  ): Promise<InventoryResponse> {
    const inventory = await this.inventoriesService.getInventoryFromCache(
      steamid,
      appid,
      contextid
    );

    if (inventory === null) {
      throw new NotFoundException('Inventory not found');
    }

    return inventory;
  }

  @Delete(INVENTORY_PATH)
  @ApiOperation({
    summary: 'Delete cached inventory and load job if one exists',
    description:
      'Delete a inventory of a Steam account from the cache and queue job if one exists.',
  })
  @ApiParamSteamID()
  @ApiParam({
    name: 'appid',
    description: 'The appid of the game',
    example: 440,
  })
  @ApiParam({
    name: 'contextid',
    description: 'The contextid of the inventory',
    example: 2,
  })
  deleteInventory(
    @Param('steamid', ParseSteamIDPipe) steamid: SteamID,
    @Param('appid', ParseIntPipe) appid: number,
    @Param('contextid') contextid: string
  ): Promise<void> {
    return this.inventoriesService.deleteInventory(steamid, appid, contextid);
  }
}

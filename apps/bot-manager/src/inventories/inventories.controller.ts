import {
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Query,
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
import { GetInventoryDto } from '@tf2-automatic/dto';
import { InventoriesService } from './inventories.service';
import { ApiParamSteamID, CachedInventoryModel } from '@tf2-automatic/swagger';

@ApiTags('Inventories')
@Controller(INVENTORIES_BASE_URL)
export class InventoriesController {
  constructor(private readonly inventoriesService: InventoriesService) {}

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
  getInventory(
    @Param('steamid', ParseSteamIDPipe) steamid: SteamID,
    @Param('appid', ParseIntPipe) appid: number,
    @Param('contextid') contextid: string,
    @Query(
      new ValidationPipe({
        transform: true,
      })
    )
    query: GetInventoryDto
  ): Promise<InventoryResponse> {
    return this.inventoriesService.getInventory(
      steamid,
      appid,
      contextid,
      query
    );
  }

  @Delete(INVENTORY_PATH)
  @ApiOperation({
    summary: 'Delete cached inventory',
    description: 'Delete a inventory of a Steam account from the cache.',
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

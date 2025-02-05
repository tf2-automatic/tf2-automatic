import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseBoolPipe,
  ParseIntPipe,
  Post,
  Query,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import {
  INVENTORIES_BASE_URL,
  InventoryResponse,
  INVENTORY_PATH,
  INVENTORY_FETCH_PATH,
} from '@tf2-automatic/bot-manager-data';
import { ParseSteamIDPipe } from '@tf2-automatic/nestjs-steamid-pipe';
import SteamID from 'steamid';
import { EnqueueInventoryDto } from '@tf2-automatic/dto';
import {
  InventoriesService,
  INVENTORY_EXPIRE_TIME,
} from './inventories.service';
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
  async addInventoryToQueue(
    @Param('steamid', ParseSteamIDPipe) steamid: SteamID,
    @Param('appid', ParseIntPipe) appid: number,
    @Param('contextid') contextid: string,
    @Body(new ValidationPipe()) body: EnqueueInventoryDto,
  ): Promise<void> {
    await this.inventoriesService.addToQueue(steamid, appid, contextid, body);
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
  @ApiQuery({
    name: 'tradableOnly',
    description:
      'Set to false to include non-tradable items in the response. Defaults to true.',
    example: true,
    required: false,
  })
  getInventory(
    @Param('steamid', ParseSteamIDPipe) steamid: SteamID,
    @Param('appid', ParseIntPipe) appid: number,
    @Param('contextid') contextid: string,
    @Query('tradableOnly', new ParseBoolPipe({ optional: true }))
    tradableOnly?: boolean,
  ): Promise<InventoryResponse> {
    return this.inventoriesService.getInventoryFromCache(
      steamid,
      appid,
      contextid,
      tradableOnly,
    );
  }

  @Get(INVENTORY_FETCH_PATH)
  @ApiOperation({
    summary: 'Fetch inventory',
    description: 'Gets the inventory from the cache or waits for it to load.',
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
  @ApiQuery({
    name: 'useCache',
    description: 'Get inventory from cache if available. Default is true.',
    example: true,
    required: false,
  })
  @ApiQuery({
    name: 'tradableOnly',
    description: 'Only get tradable items.',
    example: true,
    required: false,
  })
  @ApiQuery({
    name: 'ttl',
    description:
      'Time to live of the cache in seconds if the inventory is fetched from a bot. Default is ' +
      INVENTORY_EXPIRE_TIME +
      '.',
    example: INVENTORY_EXPIRE_TIME,
    required: false,
  })
  async waitForInventory(
    @Param('steamid', ParseSteamIDPipe) steamid: SteamID,
    @Param('appid', ParseIntPipe) appid: number,
    @Param('contextid') contextid: string,
    @Query('useCache', new ParseBoolPipe({ optional: true }))
    useCache = true,
    @Query('tradableOnly', new ParseBoolPipe({ optional: true }))
    tradableOnly: boolean | undefined,
    @Query('ttl', new ParseIntPipe({ optional: true }))
    ttl: number | undefined,
  ): Promise<InventoryResponse> {
    return this.inventoriesService.fetchInventory(
      steamid,
      appid,
      contextid,
      useCache,
      tradableOnly,
      ttl,
    );
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
    @Param('contextid') contextid: string,
  ): Promise<void> {
    return this.inventoriesService.deleteInventory(steamid, appid, contextid);
  }
}

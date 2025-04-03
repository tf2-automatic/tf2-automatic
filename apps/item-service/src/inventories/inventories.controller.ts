import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  ValidationPipe,
} from '@nestjs/common';
import { InventoriesService } from './inventories.service';
import {
  GetInventoryDto,
  INVENTORIES_BASE_PATH,
  INVENTORY_FETCH_PATH,
  INVENTORY_PATH,
  INVENTORY_QUEUE_PATH,
} from '@tf2-automatic/item-service-data';
import { ParseSteamIDPipe } from '@tf2-automatic/nestjs-steamid-pipe';
import SteamID from 'steamid';
import { ApiParamSteamID } from '@tf2-automatic/swagger';
import { EnqueueInventoryDto } from '@tf2-automatic/dto';
import { ApiOperation } from '@nestjs/swagger';

@Controller(INVENTORIES_BASE_PATH)
export class InventoriesController {
  constructor(private readonly inventoriesService: InventoriesService) {}

  @Post(INVENTORY_QUEUE_PATH)
  @ApiOperation({
    summary: 'Add inventory to queue',
    description: 'Adds an inventory load job to the queue.',
  })
  @ApiParamSteamID()
  async addJob(
    @Param('steamid', ParseSteamIDPipe) steamid: SteamID,
    @Body(new ValidationPipe({ transform: true })) body: EnqueueInventoryDto,
  ): Promise<void> {
    await this.inventoriesService.addJob(steamid, body);
  }

  @Delete(INVENTORY_QUEUE_PATH)
  @ApiOperation({
    summary: 'Remove inventory from queue if one exists',
    description: 'Removes an inventory load job from the queue if one exists.',
  })
  @ApiParamSteamID()
  removeJob(
    @Param('steamid', ParseSteamIDPipe) steamid: SteamID,
  ): Promise<void> {
    return this.inventoriesService.removeJob(steamid);
  }

  @Get(INVENTORY_QUEUE_PATH)
  @ApiOperation({
    summary: 'Get all inventory jobs',
    description: 'Get all inventory jobs.',
  })
  getJobs() {
    return this.inventoriesService.getJobs();
  }

  @Get(INVENTORY_FETCH_PATH)
  @ApiParamSteamID()
  fetchInventory(
    @Param('steamid', ParseSteamIDPipe) steamid: SteamID,
    @Query(new ValidationPipe({ transform: true })) dto: GetInventoryDto,
  ) {
    return this.inventoriesService.fetchInventory(steamid, dto.extract);
  }

  @Get(INVENTORY_PATH)
  @ApiParamSteamID()
  async getInventory(
    @Param('steamid', ParseSteamIDPipe) steamid: SteamID,
    @Query(new ValidationPipe({ transform: true })) dto: GetInventoryDto,
  ) {
    return this.inventoriesService.getInventoryFromCacheAndExtractAttributes(
      steamid,
      dto.extract,
    );
  }
}

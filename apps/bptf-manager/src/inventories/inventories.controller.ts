import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  ValidationPipe,
} from '@nestjs/common';
import { InventoriesService } from './inventories.service';
import SteamID from 'steamid';
import { ParseSteamIDPipe } from '@tf2-automatic/nestjs-steamid-pipe';
import {
  INVENTORIES_BASE_URL,
  INVENTORY_REFRESH_PATH,
  INVENTORY_STATUS_PATH,
  InventoryStatus,
  RefreshInventoryDto,
} from '@tf2-automatic/bptf-manager-data';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiParamSteamID } from '@tf2-automatic/swagger';

@ApiTags('Inventories')
@Controller(INVENTORIES_BASE_URL)
export class InventoriesController {
  constructor(private readonly inventoriesService: InventoriesService) {}

  @ApiOperation({
    summary: 'Request the backpack.tf inventory of an account to be refreshed',
    description:
      'Schedules a job that will keep attempting to refresh the inventory until it is refreshed',
  })
  @ApiParamSteamID('SteamID64 of the account to refresh the inventory for')
  @Post(INVENTORY_REFRESH_PATH)
  @HttpCode(HttpStatus.OK)
  async enqueue(
    @Param('steamid', ParseSteamIDPipe) steamid: SteamID,
    @Body(ValidationPipe) body: RefreshInventoryDto,
  ): Promise<void> {
    await this.inventoriesService.scheduleRefresh(steamid, body);
  }

  @ApiOperation({
    summary:
      'Stop attempting to refresh the backpack.tf inventory of an account',
    description: 'Removes the job that is attempting to refresh the inventory',
  })
  @ApiParamSteamID(
    'SteamID64 of the account to stop refreshing the inventory for',
  )
  @Delete(INVENTORY_REFRESH_PATH)
  async dequeue(
    @Param('steamid', ParseSteamIDPipe) steamid: SteamID,
  ): Promise<void> {
    await this.inventoriesService.dequeueRefresh(steamid);
  }

  @ApiOperation({
    summary: 'Get the status of the backpack.tf inventory of an account',
    description:
      'The status is updated when the inventory is attempted to be refreshed',
  })
  @ApiParamSteamID('SteamID64 of the account to get the inventory status of')
  @ApiResponse({
    type: InventoryStatus,
  })
  @Get(INVENTORY_STATUS_PATH)
  async getStatus(
    @Param('steamid', ParseSteamIDPipe) steamid: SteamID,
  ): Promise<InventoryStatus> {
    const inventory = await this.inventoriesService.getInventory(steamid);

    if (inventory === null) {
      throw new NotFoundException('No status saved for the inventory');
    }

    return inventory.status;
  }
}

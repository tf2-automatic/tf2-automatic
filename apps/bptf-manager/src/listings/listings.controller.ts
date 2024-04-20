import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseArrayPipe,
  Post,
} from '@nestjs/common';
import { ListingLimitsService } from './listing-limits.service';
import {
  DesiredListingDto,
  DesiredListingModel,
  RemoveListingDto,
  ListingLimitsModel,
} from '@tf2-automatic/bptf-manager-data';
import { ParseSteamIDPipe } from '@tf2-automatic/nestjs-steamid-pipe';
import SteamID from 'steamid';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiParamSteamID } from '@tf2-automatic/swagger';
import { DesiredListingsService } from './desired-listings.service';
import { CurrentListingsService } from './current-listings.service';

@ApiTags('Listings')
@Controller('listings')
export class ListingsController {
  constructor(
    private readonly listingLimitsService: ListingLimitsService,
    private readonly desiredListingsService: DesiredListingsService,
    private readonly currentListingsService: CurrentListingsService,
  ) {}

  @ApiOperation({
    summary: 'Add desired listings',
    description: 'Add desired listings to the database',
  })
  @ApiBody({
    type: [DesiredListingDto],
  })
  @ApiResponse({
    type: [DesiredListingModel],
  })
  @ApiParamSteamID()
  @Post('/:steamid/desired')
  async addDesired(
    @Param('steamid', ParseSteamIDPipe) steamid: SteamID,
    @Body(new ParseArrayPipe({ items: DesiredListingDto }))
    add: DesiredListingDto[],
  ): Promise<DesiredListingModel[]> {
    const desired = await this.desiredListingsService.addDesired(steamid, add);

    return desired.map((d) => d.toJSON());
  }

  @ApiOperation({
    summary: 'Remove desired listings',
    description: 'Remove desired listings from the database',
  })
  @ApiResponse({
    type: [DesiredListingModel],
  })
  @ApiParamSteamID()
  @Delete('/:steamid/desired')
  async removeDesired(
    @Param('steamid', ParseSteamIDPipe) steamid: SteamID,
    @Body(new ParseArrayPipe({ items: RemoveListingDto }))
    remove: RemoveListingDto[],
  ) {
    const desired = await this.desiredListingsService.removeDesired(
      steamid,
      remove,
    );

    return desired.map((d) => d.toJSON());
  }

  @ApiOperation({
    summary: 'Get desired listings',
    description: 'Get all desired listings from the database',
  })
  @ApiResponse({
    type: [DesiredListingModel],
  })
  @ApiParamSteamID()
  @Get('/:steamid/desired')
  async getDesired(
    @Param('steamid', ParseSteamIDPipe) steamid: SteamID,
  ): Promise<DesiredListingModel[]> {
    const desired = await this.desiredListingsService.getAllDesired(steamid);

    return desired.map((d) => d.toJSON());
  }

  @ApiOperation({
    summary: 'Get current listings',
    description: 'Get all current listings from the database',
  })
  @ApiParamSteamID()
  @Get('/:steamid/current')
  getCurrent(@Param('steamid', ParseSteamIDPipe) steamid: SteamID) {
    return this.currentListingsService.getAllCurrent(steamid);
  }

  @ApiOperation({
    summary: 'Refresh current listings',
    description: 'Requests current listings to be refreshed from backpack.tf',
  })
  @ApiParamSteamID()
  @Post('/:steamid/current/refresh')
  refreshCurrent(@Param('steamid', ParseSteamIDPipe) steamid: SteamID) {
    return this.currentListingsService.refreshListings(steamid);
  }

  @ApiOperation({
    summary: 'Get listing limits',
    description: 'Get listing limits from the database',
  })
  @ApiResponse({
    type: ListingLimitsModel,
  })
  @ApiParamSteamID()
  @Get('/:steamid/limits')
  getLimits(@Param('steamid', ParseSteamIDPipe) steamid: SteamID) {
    return this.listingLimitsService.getLimits(steamid);
  }

  @ApiOperation({
    summary: 'Refresh listing limits',
    description: 'Requests listing limits to be refreshed',
  })
  @ApiParamSteamID()
  @Post('/:steamid/limits/refresh')
  refreshLimits(@Param('steamid', ParseSteamIDPipe) steamid: SteamID) {
    return this.listingLimitsService.refreshLimits(steamid);
  }
}

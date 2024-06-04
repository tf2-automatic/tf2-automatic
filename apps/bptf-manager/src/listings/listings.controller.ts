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
  LISTINGS_BASE_URL,
  DESIRED_LISTINGS_PATH,
  CURRENT_LISTINGS_PATH,
  CURRENT_LISTINGS_REFRESH_PATH,
  LISTING_LIMITS_PATH,
  LISTING_LIMITS_REFRESH_PATH,
} from '@tf2-automatic/bptf-manager-data';
import { ParseSteamIDPipe } from '@tf2-automatic/nestjs-steamid-pipe';
import SteamID from 'steamid';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiParamSteamID } from '@tf2-automatic/swagger';
import { DesiredListingsService } from './desired-listings.service';
import { CurrentListingsService } from './current-listings.service';

@ApiTags('Listings')
@Controller(LISTINGS_BASE_URL)
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
  @Post(DESIRED_LISTINGS_PATH)
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
  @Delete(DESIRED_LISTINGS_PATH)
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
  @Get(DESIRED_LISTINGS_PATH)
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
  @Get(CURRENT_LISTINGS_PATH)
  getCurrent(@Param('steamid', ParseSteamIDPipe) steamid: SteamID) {
    return this.currentListingsService.getAllCurrent(steamid);
  }

  @ApiOperation({
    summary: 'Refresh current listings',
    description: 'Requests current listings to be refreshed from backpack.tf',
  })
  @ApiParamSteamID()
  @Post(CURRENT_LISTINGS_REFRESH_PATH)
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
  @Get(LISTING_LIMITS_PATH)
  getLimits(@Param('steamid', ParseSteamIDPipe) steamid: SteamID) {
    return this.listingLimitsService.getLimits(steamid);
  }

  @ApiOperation({
    summary: 'Refresh listing limits',
    description: 'Requests listing limits to be refreshed',
  })
  @ApiParamSteamID()
  @Post(LISTING_LIMITS_REFRESH_PATH)
  refreshLimits(@Param('steamid', ParseSteamIDPipe) steamid: SteamID) {
    return this.listingLimitsService.refreshLimits(steamid);
  }
}

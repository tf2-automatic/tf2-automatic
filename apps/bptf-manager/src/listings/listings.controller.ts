import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseArrayPipe,
  Post,
} from '@nestjs/common';
import { ListingsService } from './listings.service';
import {
  DesiredListing,
  DesiredListingDto,
  ListingDto,
} from '@tf2-automatic/bptf-manager-data';
import { ParseSteamIDPipe } from '@tf2-automatic/nestjs-steamid-pipe';
import SteamID from 'steamid';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiParamSteamID } from '@tf2-automatic/swagger';

@ApiTags('Listings')
@Controller('listings')
export class ListingsController {
  constructor(private readonly listingsService: ListingsService) {}

  // TODO: Add API responses and request bodies

  @ApiOperation({
    summary: 'Add desired listings',
    description: 'Add desired listings to the database',
  })
  @ApiParamSteamID()
  @Post('/:steamid/desired')
  addDesired(
    @Param('steamid', ParseSteamIDPipe) steamid: SteamID,
    @Body(new ParseArrayPipe({ items: DesiredListingDto }))
    add: DesiredListingDto[],
  ): Promise<DesiredListing[]> {
    return this.listingsService.addDesired(steamid, add);
  }

  @ApiOperation({
    summary: 'Remove desired listings',
    description: 'Remove desired listings from the database',
  })
  @ApiParamSteamID()
  @Delete('/:steamid/desired')
  removeDesired(
    @Param('steamid', ParseSteamIDPipe) steamid: SteamID,
    @Body(new ParseArrayPipe({ items: ListingDto }))
    remove: ListingDto[],
  ) {
    return this.listingsService.removeDesired(steamid, remove);
  }

  @ApiOperation({
    summary: 'Get desired listings',
    description: 'Get all desired listings from the database',
  })
  @ApiParamSteamID()
  @Get('/:steamid/desired')
  getDesired(@Param('steamid', ParseSteamIDPipe) steamid: SteamID) {
    return this.listingsService
      .getAllDesired(steamid)
      .then((desired) => this.listingsService.mapDesired(desired));
  }

  @ApiOperation({
    summary: 'Get current listings',
    description: 'Get all current listings from the database',
  })
  @ApiParamSteamID()
  @Get('/:steamid/current')
  getCurrent(@Param('steamid', ParseSteamIDPipe) steamid: SteamID) {
    return this.listingsService.getCurrent(steamid);
  }

  @ApiOperation({
    summary: 'Get listing limits',
    description: 'Get listing limits from the database',
  })
  @ApiParamSteamID()
  @Get('/:steamid/limits')
  getLimits(@Param('steamid', ParseSteamIDPipe) steamid: SteamID) {
    return this.listingsService.getLimits(steamid);
  }

  @ApiOperation({
    summary: 'Refresh listing limits',
    description: 'Requests listing limits to be refreshed',
  })
  @ApiParamSteamID()
  @Post('/:steamid/limits/refresh')
  refreshLimits(@Param('steamid', ParseSteamIDPipe) steamid: SteamID) {
    return this.listingsService.refreshLimits(steamid);
  }
}

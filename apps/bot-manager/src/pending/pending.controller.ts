import { Controller, Get, Param } from '@nestjs/common';
import { PendingService } from './pending.service';
import { ParseSteamIDPipe } from '@tf2-automatic/nestjs-steamid-pipe';
import SteamID from 'steamid';

@Controller('pending')
export class PendingController {
  constructor(private readonly pendingService: PendingService) {}

  @Get('/:steamid')
  getPending(@Param('steamid', ParseSteamIDPipe) steamid: SteamID) {
    return this.pendingService.getPendingAssets(steamid);
  }
}

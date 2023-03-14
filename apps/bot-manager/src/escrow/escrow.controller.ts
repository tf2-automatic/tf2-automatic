import { Controller, Delete, Get, Param } from '@nestjs/common';
import { ESCROW_BASE_URL, ESCROW_PATH } from '@tf2-automatic/bot-manager-data';
import { ParseSteamIDPipe } from '@tf2-automatic/nestjs-steamid-pipe';
import SteamID from 'steamid';
import { EscrowService } from './escrow.service';

@Controller(ESCROW_BASE_URL)
export class EscrowController {
  constructor(private readonly escrowService: EscrowService) {}

  @Get(ESCROW_PATH)
  getEscrow(@Param('steamid', ParseSteamIDPipe) steamid: SteamID) {
    return this.escrowService.getEscrow(steamid);
  }

  @Delete(ESCROW_PATH)
  deleteEscrow(@Param('steamid', ParseSteamIDPipe) steamid: SteamID) {
    return this.escrowService.deleteEscrow(steamid);
  }
}

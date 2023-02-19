import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ESCROW_BASE_URL,
  ESCROW_GET_DURATION,
  GetEscrowResponse,
} from '@tf2-automatic/bot-data';
import { ParseSteamIDPipe } from '@tf2-automatic/nestjs-steamid-pipe';
import SteamID from 'steamid';
import { EscrowService } from './escrow.service';

@Controller(ESCROW_BASE_URL)
export class EscrowController {
  constructor(private readonly escrowService: EscrowService) {}

  @Get(ESCROW_GET_DURATION)
  getEscrowDuration(
    @Param('steamid', ParseSteamIDPipe) steamid: SteamID,
    @Query('token') token: string
  ): Promise<GetEscrowResponse> {
    return this.escrowService
      .getEscrowDuration(steamid, token)
      .then((escrowDays) => {
        return {
          escrowDays,
        };
      });
  }
}

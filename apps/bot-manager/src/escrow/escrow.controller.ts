import {
  Controller,
  Delete,
  Get,
  Param,
  Query,
  ValidationPipe,
} from '@nestjs/common';
import { ESCROW_BASE_URL, ESCROW_PATH } from '@tf2-automatic/bot-manager-data';
import { ParseSteamIDPipe } from '@tf2-automatic/nestjs-steamid-pipe';
import SteamID from 'steamid';
import { GetEscrowDto } from './dto/get-escrow.dto';
import { EscrowService } from './escrow.service';

@Controller(ESCROW_BASE_URL)
export class EscrowController {
  constructor(private readonly escrowService: EscrowService) {}

  @Get(ESCROW_PATH)
  getEscrow(
    @Param('steamid', ParseSteamIDPipe) steamid: SteamID,
    @Query(
      new ValidationPipe({
        transform: true,
      })
    )
    query: GetEscrowDto
  ) {
    return this.escrowService.getEscrow(steamid, query);
  }

  @Delete(ESCROW_PATH)
  deleteEscrow(@Param('steamid', ParseSteamIDPipe) steamid: SteamID) {
    return this.escrowService.deleteEscrow(steamid);
  }
}

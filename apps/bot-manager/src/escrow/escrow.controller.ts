import {
  Controller,
  Delete,
  Get,
  Param,
  Query,
  ValidationPipe,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ESCROW_BASE_URL, ESCROW_PATH } from '@tf2-automatic/bot-manager-data';
import { ParseSteamIDPipe } from '@tf2-automatic/nestjs-steamid-pipe';
import { ApiParamSteamID, EscrowModel } from '@tf2-automatic/swagger';
import SteamID from 'steamid';
import { GetEscrowDto } from './dto/get-escrow.dto';
import { EscrowService } from './escrow.service';

@ApiTags('Escrow')
@Controller(ESCROW_BASE_URL)
export class EscrowController {
  constructor(private readonly escrowService: EscrowService) {}

  @Get(ESCROW_PATH)
  @ApiOperation({
    summary: 'Get escrow',
    description:
      'Get the amount of days a trade with a specific Steam account would be held in escrow for. Saves and gets escrow days to and from cache.',
  })
  @ApiParamSteamID('The SteamID64 of the account you want to check')
  @ApiOkResponse({
    description: 'Escrow response',
    type: EscrowModel,
  })
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
  @ApiOperation({
    summary: 'Delete escrow',
    description: 'Delete the cached escrow days for a specific Steam account.',
  })
  @ApiParamSteamID()
  deleteEscrow(@Param('steamid', ParseSteamIDPipe) steamid: SteamID) {
    return this.escrowService.deleteEscrow(steamid);
  }
}

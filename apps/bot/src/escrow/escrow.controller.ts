import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  ESCROW_BASE_URL,
  ESCROW_GET_DURATION,
  GetEscrowResponse,
} from '@tf2-automatic/bot-data';
import { ParseSteamIDPipe } from '@tf2-automatic/nestjs-steamid-pipe';
import SteamID from 'steamid';
import { ApiParamSteamID } from '../common/swagger/api-param-steamid64.decorator';
import { EscrowService } from './escrow.service';

@ApiTags('Escrow')
@Controller(ESCROW_BASE_URL)
export class EscrowController {
  constructor(private readonly escrowService: EscrowService) {}

  @Get(ESCROW_GET_DURATION)
  @ApiOperation({
    summary: 'Get escrow duration',
    description:
      'Get the escrow duration of a trade between this bot and a given Steam account',
  })
  @ApiParamSteamID()
  @ApiQuery({
    name: 'token',
    description: 'The token from their trade offer url',
    example: '_Eq1Y3An',
    required: false,
  })
  getEscrowDuration(
    @Param('steamid', ParseSteamIDPipe) steamid: SteamID,
    @Query('token')
    token?: string
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

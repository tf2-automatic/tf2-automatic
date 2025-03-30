import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  ValidationPipe,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ESCROW_BASE_URL,
  ESCROW_FETCH_PATH,
  ESCROW_PATH,
  ESCROW_QUEUE_PATH,
} from '@tf2-automatic/bot-manager-data';
import { ParseSteamIDPipe } from '@tf2-automatic/nestjs-steamid-pipe';
import { ApiParamSteamID, EscrowModel } from '@tf2-automatic/swagger';
import SteamID from 'steamid';
import { GetEscrowDto } from '@tf2-automatic/dto';
import { EscrowService } from './escrow.service';

@ApiTags('Escrow')
@Controller(ESCROW_BASE_URL)
export class EscrowController {
  constructor(private readonly escrowService: EscrowService) {}

  @Post(ESCROW_QUEUE_PATH)
  @ApiOperation({
    summary: 'Add escrow job',
    description: 'Add an escrow job to the queue.',
  })
  @ApiParamSteamID()
  async addJob(
    @Param('steamid', ParseSteamIDPipe) steamid: SteamID,
    @Body(
      new ValidationPipe({
        transform: true,
      }),
    )
    dto: GetEscrowDto,
  ) {
    await this.escrowService.addJob(steamid, dto);
  }

  @Delete(ESCROW_QUEUE_PATH)
  @ApiOperation({
    summary: 'Remove escrow job',
    description: 'Remove an escrow job from the queue.',
  })
  @ApiParamSteamID()
  async removeJob(@Param('steamid', ParseSteamIDPipe) steamid: SteamID) {
    return this.escrowService
      .removeJob(steamid)
      .then((deleted) => ({ deleted }));
  }

  @Get(ESCROW_FETCH_PATH)
  @ApiOperation({
    summary: 'Fetch escrow',
    description: 'Fetch the escrow days for a specific Steam account.',
  })
  @ApiParamSteamID()
  @ApiOkResponse({
    description: 'Escrow response',
    type: EscrowModel,
  })
  fetchEscrow(
    @Param('steamid', ParseSteamIDPipe) steamid: SteamID,
    @Query(
      new ValidationPipe({
        transform: true,
      }),
    )
    query: GetEscrowDto,
  ) {
    return this.escrowService.getEscrow(steamid, query);
  }

  @Get(ESCROW_PATH)
  @ApiOperation({
    summary: 'Get escrow',
    description: 'Get the cached escrow days for a specific Steam account.',
  })
  @ApiParamSteamID()
  @ApiOkResponse({
    description: 'Escrow response',
    type: EscrowModel,
  })
  getEscrow(@Param('steamid', ParseSteamIDPipe) steamid: SteamID) {
    return this.escrowService.getEscrowFromCache(steamid);
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

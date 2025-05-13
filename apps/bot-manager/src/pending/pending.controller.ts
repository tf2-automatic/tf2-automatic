import { Controller, Get, Param } from '@nestjs/common';
import { PendingService } from './pending.service';
import { ParseSteamIDPipe } from '@tf2-automatic/nestjs-steamid-pipe';
import SteamID from 'steamid';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiParamSteamID } from '@tf2-automatic/swagger';
import {
  PENDING_BASE_URL,
  PENDING_PATH,
  PendingResponse,
} from '@tf2-automatic/bot-manager-data';

@ApiTags('Pending')
@Controller(PENDING_BASE_URL)
export class PendingController {
  constructor(private readonly pendingService: PendingService) {}

  @Get(PENDING_PATH)
  @ApiOperation({
    summary: 'Get pending assets of an account',
    description:
      'Gets assets pending to be lost and gained by steamid. Keys are in the format `appid_contextid_assetid` and values are the sum of all amounts of the asset in active trade offers.',
  })
  @ApiParamSteamID()
  @ApiResponse({
    description: `An example result for the steamid 76561198120070906. They are losing two assets, one with the appid 440, contextid 2, assetid 13658527176 and an amount of 1, and losing another with appid 753, contextid 6, assetid 1872890367 and an amount of 100. They are also gaining an asset with the assetid 15580208257, but the amount is 2, which in this example means that there are two active trade offers where they gain the same asset. The asset with an amount of 100 is actually Steam gems.`,
    status: 200,
    example: {
      gain: {
        '76561198280567987_440_2_15580208257': 2,
      },
      lose: {
        '76561198120070906_440_2_13658527176': 1,
        '76561198120070906_753_6_1872890367': 100,
      },
    },
  })
  getPending(
    @Param('steamid', ParseSteamIDPipe) steamid: SteamID,
  ): Promise<PendingResponse> {
    return this.pendingService.getPendingAssets(steamid);
  }
}

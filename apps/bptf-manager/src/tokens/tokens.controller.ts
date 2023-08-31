import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  ValidationPipe,
} from '@nestjs/common';

import {
  SaveTokenDto,
  TOKENS_BASE_URL,
  TOKENS_PATH,
  TOKEN_PATH,
} from '@tf2-automatic/bptf-manager-data';
import { TokensService } from './tokens.service';
import { ParseSteamIDPipe } from '@tf2-automatic/nestjs-steamid-pipe';
import SteamID from 'steamid';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiParamSteamID } from '@tf2-automatic/swagger';

@ApiTags('Tokens')
@Controller(TOKENS_BASE_URL)
export class TokensController {
  constructor(private readonly tokensService: TokensService) {}

  @ApiOperation({
    summary: 'Save a backpack.tf access token',
  })
  @Post(TOKENS_PATH)
  saveToken(
    @Body(ValidationPipe)
    dto: SaveTokenDto,
  ) {
    return this.tokensService.saveToken(dto);
  }

  @ApiOperation({
    summary: 'Get a list of SteamID64s with a backpack.tf access token',
  })
  @ApiOkResponse({
    type: [String],
  })
  @Get(TOKENS_PATH)
  getSteamID64(): Promise<string[]> {
    return this.tokensService.getSteamIDs();
  }

  @ApiOperation({
    summary: 'Delete a backpack.tf access token',
  })
  @ApiParamSteamID('SteamID64 of the account to delete the token for')
  @Delete(TOKEN_PATH)
  deleteToken(@Param('steamid', ParseSteamIDPipe) steamid: SteamID) {
    return this.tokensService.deleteToken(steamid);
  }
}

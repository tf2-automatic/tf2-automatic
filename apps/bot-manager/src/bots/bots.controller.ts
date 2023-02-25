import { Controller, ValidationPipe } from '@nestjs/common';
import { Post } from '@nestjs/common';
import { Param } from '@nestjs/common';
import { Get, HttpCode } from '@nestjs/common';
import { Delete } from '@nestjs/common';
import { Body } from '@nestjs/common';
import { ParseSteamIDPipe } from '@tf2-automatic/nestjs-steamid-pipe';
import SteamID from 'steamid';
import { BotsService } from './bots.service';
import { BotHeartbeatDto } from './dto/bot-heartbeat.dto';

@Controller('bots')
export class BotsController {
  constructor(private readonly botsService: BotsService) {}

  @Post('/:steamid/heartbeat')
  @HttpCode(200)
  handleHeartbeat(
    @Param('steamid', ParseSteamIDPipe) steamid: SteamID,
    @Body(ValidationPipe) heartbeat: BotHeartbeatDto
  ) {
    return this.botsService.saveBot(steamid, heartbeat);
  }

  @Delete('/:steamid')
  handleDelete(@Param('steamid', ParseSteamIDPipe) steamid: SteamID) {
    return this.botsService.deleteBot(steamid);
  }

  @Get('/:steamid')
  getBot(@Param('steamid', ParseSteamIDPipe) steamid: SteamID) {
    return this.botsService.getBot(steamid);
  }
}

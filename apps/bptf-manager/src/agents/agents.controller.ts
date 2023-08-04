import { Controller, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { ParseSteamIDPipe } from '@tf2-automatic/nestjs-steamid-pipe';
import SteamID from 'steamid';
import {
  AGENTS_BASE_URL,
  AGENT_REGISTER_PATH,
  AGENT_UNREGISTER_PATH,
} from '@tf2-automatic/bptf-manager-data';

@Controller(AGENTS_BASE_URL)
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Post(AGENT_REGISTER_PATH)
  @HttpCode(HttpStatus.OK)
  async registerAgent(@Param('steamid', ParseSteamIDPipe) steamid: SteamID) {
    await this.agentsService.enqueueRegisterAgent(steamid);
  }

  @Post(AGENT_UNREGISTER_PATH)
  @HttpCode(HttpStatus.OK)
  async unregisterAgent(@Param('steamid', ParseSteamIDPipe) steamid: SteamID) {
    await this.agentsService.enqueueUnregisterAgent(steamid);
  }
}

import { Controller, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { ParseSteamIDPipe } from '@tf2-automatic/nestjs-steamid-pipe';
import SteamID from 'steamid';
import {
  AGENTS_BASE_URL,
  AGENT_REGISTER_PATH,
  AGENT_UNREGISTER_PATH,
} from '@tf2-automatic/bptf-manager-data';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Agents')
@Controller(AGENTS_BASE_URL)
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @ApiOperation({
    summary: 'Register an agent',
    description: 'Repeatedly registers an agent with backpack.tf',
  })
  @Post(AGENT_REGISTER_PATH)
  @HttpCode(HttpStatus.OK)
  async registerAgent(@Param('steamid', ParseSteamIDPipe) steamid: SteamID) {
    await this.agentsService.enqueueRegisterAgent(steamid);
  }

  @ApiOperation({
    summary: 'Unregister an agent',
    description:
      'Stops repeatedly registering an agent and unregisters it with backpack.tf',
  })
  @Post(AGENT_UNREGISTER_PATH)
  @HttpCode(HttpStatus.OK)
  async unregisterAgent(@Param('steamid', ParseSteamIDPipe) steamid: SteamID) {
    await this.agentsService.enqueueUnregisterAgent(steamid);
  }
}

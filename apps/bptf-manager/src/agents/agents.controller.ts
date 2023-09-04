import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  ValidationPipe,
} from '@nestjs/common';
import { AgentsService } from './agents.service';
import { ParseSteamIDPipe } from '@tf2-automatic/nestjs-steamid-pipe';
import SteamID from 'steamid';
import {
  AGENTS_BASE_URL,
  AGENTS_PATH,
  AGENT_REGISTER_PATH,
  AGENT_UNREGISTER_PATH,
  Agent,
  CreateAgentDto,
  AgentModel,
} from '@tf2-automatic/bptf-manager-data';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Agents')
@Controller(AGENTS_BASE_URL)
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @ApiOperation({
    summary: 'Get all agents',
    description: 'Returns all agents that are currently registered',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: [AgentModel],
  })
  @Get(AGENTS_PATH)
  getAgents(): Promise<Agent[]> {
    return this.agentsService.getAgents();
  }

  @ApiOperation({
    summary: 'Register an agent',
    description: 'Repeatedly registers an agent with backpack.tf',
  })
  @ApiBody({
    type: CreateAgentDto,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: AgentModel,
  })
  @Post(AGENT_REGISTER_PATH)
  @HttpCode(HttpStatus.OK)
  async registerAgent(
    @Param('steamid', ParseSteamIDPipe) steamid: SteamID,
    @Body(ValidationPipe) dto: CreateAgentDto,
  ): Promise<Agent> {
    return this.agentsService.enqueueRegisterAgent(steamid, dto);
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

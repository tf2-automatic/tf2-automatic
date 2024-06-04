import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export const AGENTS_BASE_URL = '/agents';
export const AGENTS_PATH = '/';
export const AGENT_PATH = '/:steamid';
export const AGENT_REGISTER_PATH = `${AGENT_PATH}/register`;
export const AGENT_UNREGISTER_PATH = `${AGENT_PATH}/unregister`;

export const AGENTS_FULL_PATH = AGENTS_BASE_URL + AGENTS_PATH;
export const AGENT_FULL_PATH = AGENTS_BASE_URL + AGENT_PATH;
export const AGENT_REGISTER_FULL_PATH = AGENTS_BASE_URL + AGENT_REGISTER_PATH;
export const AGENT_UNREGISTER_FULL_PATH =
  AGENTS_BASE_URL + AGENT_UNREGISTER_PATH;

const now = Math.floor(Date.now() / 1000);

export class CreateAgentDto {
  @ApiProperty({
    example: 'github.com/tf2-automatic/tf2-automatic',
    description: 'The user-agent used to register the agent',
    required: false,
  })
  @IsString()
  @IsOptional()
  userAgent?: string;
}

export interface Agent {
  steamid64: string;
  userAgent: string | null;
  updatedAt: number;
}

export class AgentModel implements Agent {
  @ApiProperty({
    example: '76561198120070906',
    description: 'The SteamID64 of the agent',
  })
  steamid64!: string;

  @ApiProperty({
    example: 'github.com/tf2-automatic/tf2-automatic',
    description: 'The user-agent used to register the agent',
    nullable: true,
  })
  userAgent!: string | null;

  @ApiProperty({
    example: now,
    description: 'When the agent was last updated',
  })
  updatedAt!: number;
}

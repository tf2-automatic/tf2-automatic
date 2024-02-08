import { HttpService } from '@nestjs/axios';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { CreateAgentDto, Token } from '@tf2-automatic/bptf-manager-data';
import { AgentResponse } from './interfaces/agent-response.interface';
import { firstValueFrom } from 'rxjs';
import SteamID from 'steamid';
import { InjectRedis } from '@songkeys/nestjs-redis';
import { Redis } from 'ioredis';
import { AgentJobData } from './interfaces/queue.interface';
import { TokensService } from '../tokens/tokens.service';
import Redlock from 'redlock';
import { ConfigService } from '@nestjs/config';
import { AgentsConfig, Config } from '../common/config/configuration';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { getJobs, getRepeatableJob } from '../common/utils';
import { Agent } from '@tf2-automatic/bptf-manager-data';

const KEY = 'bptf-manager:data:agents';

@Injectable()
export class AgentsService {
  private readonly redlock: Redlock;

  constructor(
    @InjectQueue('registerAgents')
    private readonly registerAgentsQueue: Queue<AgentJobData>,
    @InjectQueue('unregisterAgents')
    private readonly unregisterAgentsQueue: Queue<AgentJobData>,
    private readonly httpService: HttpService,
    private readonly tokensService: TokensService,
    @InjectRedis() private readonly redis: Redis,
    private readonly configService: ConfigService<Config>,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.redlock = new Redlock([redis]);
  }

  async getAgents(): Promise<Agent[]> {
    const agents = await this.redis.hvals(KEY);

    return agents.map((key) => JSON.parse(key));
  }

  private async setAgent(
    steamid: SteamID,
    dto: CreateAgentDto,
  ): Promise<Agent> {
    const steamid64 = steamid.getSteamID64();

    const agent: Agent = {
      steamid64,
      userAgent: dto.userAgent ?? null,
      updatedAt: Math.floor(Date.now() / 1000),
    };

    await this.redis.hset(KEY, steamid64, JSON.stringify(agent));

    return agent;
  }

  private async deleteAgent(steamid: SteamID): Promise<void> {
    await this.redis.hdel(KEY, steamid.getSteamID64());
  }

  async getAgent(steamid: SteamID): Promise<Agent | null> {
    const steamid64 = steamid.getSteamID64();

    const value = await this.redis.hget(KEY, steamid64);

    if (value === null) {
      return null;
    }

    return JSON.parse(value);
  }

  enqueueRegisterAgent(steamid: SteamID, dto: CreateAgentDto): Promise<Agent> {
    const steamid64 = steamid.getSteamID64();

    return this.redlock.using(
      [`bptf-manager:agents:${steamid64}`],
      1000,
      async () => {
        const agent = await this.setAgent(steamid, dto);

        const job = await this.getRepeatableJob(steamid);
        if (job) {
          // Job is already queued
          return agent;
        }

        // Notify all listeners that the agent is registering
        await this.eventEmitter.emitAsync('agents.registering', steamid);

        const every =
          this.configService.getOrThrow<AgentsConfig>(
            'agents',
          ).registerInterval;

        await this.registerAgentsQueue.add(
          steamid64,
          {
            steamid64,
          },
          {
            jobId: `register:${steamid64}`,
            repeat: {
              every,
              immediately: true,
            },
          },
        );

        return agent;
      },
    );
  }

  async enqueueUnregisterAgent(steamid: SteamID): Promise<void> {
    const steamid64 = steamid.getSteamID64();

    await this.redlock.using(
      [`bptf-manager:agents:${steamid64}`],
      1000,
      async (signal) => {
        const agent = await this.getAgent(steamid);

        if (signal.aborted) {
          throw signal.error;
        }

        // Stop more attempts to refresh the agent
        await this.deleteAgent(steamid);

        if (!agent) {
          return;
        }

        // Notify all listeners that the agent is no longer registering
        await this.eventEmitter.emitAsync('agents.unregistering', steamid);

        await this.unregisterAgentsQueue.add(
          steamid64,
          {
            steamid64,
          },
          {
            jobId: `unregister:${steamid64}`,
          },
        );
      },
    );
  }

  async cleanupAndUnregisterAgent(steamid: SteamID): Promise<void> {
    // Remove repeatable job if one exists
    await this.getRepeatableJob(steamid).then((job) => {
      if (job) {
        return this.registerAgentsQueue.removeRepeatableByKey(job.key);
      }
    });

    // Remove all jobs for the agent
    await this.getJobs(steamid).then((jobs) => {
      return Promise.allSettled(jobs.map((job) => job.remove()));
    });

    // Unregister agent
    await this.tokensService.getToken(steamid).then((token) => {
      return this.unregisterAgent(token);
    });
  }

  private getRepeatableJob(steamid: SteamID) {
    return getRepeatableJob(
      this.registerAgentsQueue,
      (job) => job.name === steamid.getSteamID64(),
    );
  }

  private getJobs(steamid: SteamID) {
    return getJobs(
      this.registerAgentsQueue,
      (job) => job.data.steamid64 === steamid.getSteamID64(),
    );
  }

  registerAgent(
    token: Token,
    userAgent = 'github.com/tf2-automatic/tf2-automatic',
  ): Promise<AgentResponse> {
    const resource = `bptf-manager:agents:register:${token.steamid64}`;

    return this.redlock.using([resource], 5000, {}, async () => {
      return firstValueFrom(
        this.httpService.post<AgentResponse>(
          'https://api.backpack.tf/api/agent/pulse',
          {},
          {
            headers: {
              'User-Agent': userAgent,
              'X-Auth-Token': token.value,
            },
          },
        ),
      ).then((response) => {
        this.eventEmitter.emit(
          'agents.registered',
          new SteamID(token.steamid64),
        );

        return response.data;
      });
    });
  }

  unregisterAgent(token: Token): Promise<AgentResponse> {
    const resource = `bptf-manager:agents:register:${token.steamid64}`;

    return this.redlock.using([resource], 5000, {}, async () => {
      return firstValueFrom(
        this.httpService.post<AgentResponse>(
          'https://api.backpack.tf/api/agent/stop',
          {},
          {
            headers: {
              'X-Auth-Token': token.value,
            },
          },
        ),
      ).then((response) => {
        this.eventEmitter.emit(
          'agents.unregistered',
          new SteamID(token.steamid64),
        );
        return response.data;
      });
    });
  }
}

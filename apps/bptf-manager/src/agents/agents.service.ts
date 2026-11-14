import { HttpService } from '@nestjs/axios';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import { CreateAgentDto, Token, Agent } from '@tf2-automatic/bptf-manager-data';
import { AgentResponse } from './interfaces/agent-response.interface';
import { firstValueFrom } from 'rxjs';
import SteamID from 'steamid';
import { RedisService } from '@liaoliaots/nestjs-redis';
import { Redis } from 'ioredis';
import { AgentJobData } from './interfaces/queue.interface';
import { TokensService } from '../tokens/tokens.service';
import { ConfigService } from '@nestjs/config';
import { AgentsConfig, Config } from '../common/config/configuration';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { getJobs } from '@tf2-automatic/queue';
import { LockDuration, Locker } from '@tf2-automatic/locking';
import { pack, unpack } from 'msgpackr';

const KEY = 'agents';

function getSchedulerId(steamid64: string): string {
  return `register_${steamid64}`;
}

@Injectable()
export class AgentsService implements OnModuleInit {
  private readonly redis: Redis = this.redisService.getOrThrow();
  private readonly locker: Locker = new Locker(this.redis);
  private readonly logger = new Logger(AgentsService.name);

  constructor(
    @InjectQueue('registerAgents')
    private readonly registerAgentsQueue: Queue<AgentJobData>,
    @InjectQueue('unregisterAgents')
    private readonly unregisterAgentsQueue: Queue<AgentJobData>,
    private readonly httpService: HttpService,
    private readonly tokensService: TokensService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService<Config>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // Moves agents off the old repeatable jobs, which BullMQ 5 snaps to the interval boundary
  // TODO: remove in the next major version
  async onModuleInit(): Promise<void> {
    const every =
      this.configService.getOrThrow<AgentsConfig>('agents').registerInterval;

    const agents = await this.getAgents();

    // Checked under the lock so instances starting together migrate an agent once
    await Promise.all(
      agents.map((agent, i) =>
        this.locker.using(
          [`agents:${agent.steamid64}`],
          LockDuration.SHORT,
          async () => {
            const scheduler = await this.registerAgentsQueue.getJobScheduler(
              getSchedulerId(agent.steamid64),
            );
            if (!scheduler) {
              // Spreads the moved agents evenly over the interval
              await this.scheduleRegister(
                agent.steamid64,
                Math.floor((i * every) / agents.length),
              );
            }
          },
        ),
      ),
    );
  }

  async getAgents(): Promise<Agent[]> {
    const agents = await this.redis.hvalsBuffer(KEY);

    return agents.map((key) => unpack(key));
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

    await this.redis.hset(KEY, steamid64, pack(agent));

    return agent;
  }

  private async deleteAgent(steamid: SteamID): Promise<void> {
    await this.redis.hdel(KEY, steamid.getSteamID64());
  }

  async getAgent(steamid: SteamID): Promise<Agent | null> {
    const steamid64 = steamid.getSteamID64();

    const value = await this.redis.hgetBuffer(KEY, steamid64);

    if (value === null) {
      return null;
    }

    return unpack(value);
  }

  enqueueRegisterAgent(steamid: SteamID, dto: CreateAgentDto): Promise<Agent> {
    const steamid64 = steamid.getSteamID64();

    return this.locker.using(
      [`agents:${steamid64}`],
      LockDuration.SHORT,
      async () => {
        const agent = await this.setAgent(steamid, dto);

        const scheduler = await this.registerAgentsQueue.getJobScheduler(
          getSchedulerId(steamid64),
        );
        if (scheduler) {
          // Job is already scheduled
          return agent;
        }

        // Notify all listeners that the agent is registering
        await this.eventEmitter.emitAsync('agents.registering', steamid);

        await this.scheduleRegister(steamid64);

        return agent;
      },
    );
  }

  async enqueueUnregisterAgent(steamid: SteamID): Promise<void> {
    const steamid64 = steamid.getSteamID64();

    await this.locker.using(
      [`agents:${steamid64}`],
      LockDuration.SHORT,
      async (signal) => {
        const agent = await this.getAgent(steamid);
        if (!agent) {
          return;
        }

        if (signal.aborted) {
          throw signal.error;
        }

        // Stop more attempts to refresh the agent
        await this.deleteAgent(steamid);

        // Notify all listeners that the agent is no longer registering
        await this.eventEmitter.emitAsync('agents.unregistering', steamid);

        await this.unregisterAgentsQueue.add(
          steamid64,
          {
            steamid64,
          },
          {
            jobId: `unregister_${steamid64}`,
          },
        );
      },
    );
  }

  async cleanupAndUnregisterAgent(steamid: SteamID): Promise<void> {
    // Under the same lock as registering, so a register can't land halfway
    await this.locker.using(
      [`agents:${steamid.getSteamID64()}`],
      LockDuration.MEDIUM,
      async (signal) => {
        if (await this.getAgent(steamid)) {
          this.logger.debug(
            'Skipping unregistering agent because it is registered again',
          );
          return;
        }

        await this.removeSchedulers(steamid.getSteamID64());

        // Remove all jobs for the agent
        await this.getJobs(steamid).then((jobs) => {
          return Promise.allSettled(jobs.map((job) => job.remove()));
        });

        if (signal.aborted) {
          throw signal.error;
        }

        // Unregister agent, stop is sent before a register can pulse again
        await this.tokensService.getToken(steamid).then((token) => {
          return this.unregisterAgent(token);
        });

        this.logger.log('Unregistered agent');
      },
    );
  }

  // Without an offset the scheduler pulses now and keeps that point of the interval
  private async scheduleRegister(
    steamid64: string,
    offset?: number,
  ): Promise<void> {
    const id = getSchedulerId(steamid64);
    const every =
      this.configService.getOrThrow<AgentsConfig>('agents').registerInterval;

    await this.removeSchedulers(steamid64, id);

    await this.registerAgentsQueue.upsertJobScheduler(
      id,
      { every, offset },
      { name: steamid64, data: { steamid64 } },
    );
  }

  // Also removes agents' old repeatable jobs, listed as schedulers keyed by a hash
  // TODO: remove only getSchedulerId(steamid64) in the next major version
  private async removeSchedulers(
    steamid64: string,
    keep?: string,
  ): Promise<void> {
    const schedulers = await this.registerAgentsQueue.getJobSchedulers();

    await Promise.all(
      schedulers
        .filter((s) => s.name === steamid64 && s.key !== keep)
        .map((s) => this.registerAgentsQueue.removeJobScheduler(s.key)),
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
      this.eventEmitter.emit('agents.registered', new SteamID(token.steamid64));

      return response.data;
    });
  }

  unregisterAgent(token: Token): Promise<AgentResponse> {
    return firstValueFrom(
      this.httpService.post<AgentResponse>(
        'https://api.backpack.tf/api/agent/stop',
        {},
        {
          // Registers wait for this while holding the agent lock
          timeout: 10000,
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
  }
}

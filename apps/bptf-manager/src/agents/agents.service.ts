import { HttpService } from '@nestjs/axios';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { Token } from '@tf2-automatic/bptf-manager-data';
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

const KEY_PREFIX = 'bptf-manager:data:';

interface RepeatableJob {
  key: string;
  name: string;
  id: string;
  endDate: number;
  tz: string;
  pattern: string;
  next: number;
}

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

  private async setRegistering(
    steamid: SteamID,
    registering: boolean,
  ): Promise<void> {
    const key = this.getRegisterKey(steamid.getSteamID64());

    if (registering) {
      await this.redis.set(key, 'true');
    } else {
      await this.redis.del(key);
    }
  }

  async isRegistering(steamid: SteamID): Promise<boolean> {
    const steamid64 = steamid.getSteamID64();

    const value = await this.redis.get(this.getRegisterKey(steamid64));

    return value === 'true';
  }

  async enqueueRegisterAgent(steamid: SteamID): Promise<void> {
    const steamid64 = steamid.getSteamID64();

    await this.redlock.using(
      [`bptf-manager:agents:${steamid64}`],
      1000,
      async () => {
        await this.setRegistering(steamid, true);

        const job = await this.getRepeatableJob(steamid);
        if (job) {
          // Job is already queued
          return;
        }

        // Notify all listeners that the agent is registering
        await this.eventEmitter.emitAsync('agents.registering', steamid);

        const every =
          this.configService.getOrThrow<AgentsConfig>(
            'agents',
          ).registerInterval;

        return this.registerAgentsQueue.add(
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
      },
    );
  }

  async enqueueUnregisterAgent(steamid: SteamID): Promise<void> {
    const steamid64 = steamid.getSteamID64();

    await this.redlock.using(
      [`bptf-manager:agents:${steamid64}`],
      1000,
      async (signal) => {
        const registering = await this.isRegistering(steamid);

        if (signal.aborted) {
          throw signal.error;
        }

        // Stop more attempts to refresh the agent
        await this.setRegistering(steamid, false);

        if (!registering) {
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

  async getJobs(steamid: SteamID): Promise<Job<AgentJobData>[]> {
    const match: Job[] = [];

    let start = 0;
    let moreJobs = true;

    while (moreJobs) {
      const end = start + 100;
      const jobs = await this.registerAgentsQueue.getJobs(
        undefined,
        start,
        end,
        true,
      );

      if (jobs.length !== 1 + end - start) {
        moreJobs = false;
      }

      jobs.forEach((job) => {
        if (job.data.steamid64 === steamid.getSteamID64()) {
          match.push(job);
        }
      });

      start = end + 1;
    }

    return match;
  }

  async getRepeatableJob(steamid: SteamID): Promise<RepeatableJob | null> {
    let match: RepeatableJob | null = null;

    let start = 0;
    let moreJobs = true;

    while (match === null && moreJobs) {
      const end = start + 100;
      const jobs = await this.registerAgentsQueue.getRepeatableJobs(
        start,
        end,
        true,
      );

      if (jobs.length !== 1 + end - start) {
        moreJobs = false;
      }

      jobs.forEach((job) => {
        if (job.name === steamid.getSteamID64()) {
          match = job;
        }
      });

      start = end + 1;
    }

    return match;
  }

  registerAgent(
    token: Token,
    userAgent: string = 'github.com/tf2-automatic/tf2-automatic',
  ): Promise<AgentResponse> {
    const resource = `bptf-manager:agents:register:${token.steamid64}`;

    return this.redlock.using([resource], 5000, {}, async () => {
      return firstValueFrom(
        this.httpService.post<AgentResponse>(
          'https://backpack.tf/api/agent/pulse',
          {},
          {
            headers: {
              'User-Agent': userAgent,
              'X-Auth-Token': token.value,
            },
          },
        ),
      ).then((response) => {
        return response.data;
      });
    });
  }

  unregisterAgent(token: Token): Promise<AgentResponse> {
    const resource = `bptf-manager:agents:register:${token.steamid64}`;

    return this.redlock.using([resource], 5000, {}, async () => {
      return firstValueFrom(
        this.httpService.post<AgentResponse>(
          'https://backpack.tf/api/agent/stop',
          {},
          {
            headers: {
              'X-Auth-Token': token.value,
            },
          },
        ),
      ).then((response) => {
        return response.data;
      });
    });
  }

  private getRegisterKey(steamid64: string) {
    return KEY_PREFIX + 'agents:register:' + steamid64;
  }
}

import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RedisService } from '@liaoliaots/nestjs-redis';
import { Agent } from '@tf2-automatic/bptf-manager-data';
import { Queue } from 'bullmq';
import { pack } from 'msgpackr';
import SteamID from 'steamid';
import { Config } from '../common/config/configuration';
import { TokensService } from '../tokens/tokens.service';
import { AgentsService } from './agents.service';
import { AgentResponse } from './interfaces/agent-response.interface';

jest.mock('@tf2-automatic/locking', () => ({
  LockDuration: { SHORT: 0, MEDIUM: 1, LONG: 2 },
  Locker: jest.fn().mockImplementation(() => ({
    using: jest.fn((_r, _d, routine) => routine({ aborted: false })),
  })),
}));

describe('AgentsService', () => {
  const steamid = new SteamID('76561198120070906');
  const token = { steamid64: steamid.getSteamID64(), value: 'token' };

  function setup(agent: Agent | null) {
    const redis = {
      hgetBuffer: jest.fn().mockResolvedValue(agent ? pack(agent) : null),
    };
    const queue = {
      getRepeatableJobs: jest
        .fn()
        .mockResolvedValue([{ key: 'k', name: steamid.getSteamID64() }]),
      removeRepeatableByKey: jest.fn(),
      getJobs: jest.fn().mockResolvedValue([]),
    };
    const tokensService = { getToken: jest.fn().mockResolvedValue(token) };

    const service = new AgentsService(
      queue as unknown as Queue,
      {} as Queue,
      {} as HttpService,
      tokensService as unknown as TokensService,
      { getOrThrow: () => redis } as unknown as RedisService,
      {} as ConfigService<Config>,
      {} as EventEmitter2,
    );

    const stop = jest
      .spyOn(service, 'unregisterAgent')
      .mockResolvedValue({} as AgentResponse);

    return { service, queue, stop };
  }

  it('skips cleanup when the agent is registered again', async () => {
    const { service, queue, stop } = setup({
      steamid64: steamid.getSteamID64(),
      userAgent: null,
      updatedAt: 0,
    });

    await service.cleanupAndUnregisterAgent(steamid);

    expect(queue.removeRepeatableByKey).not.toHaveBeenCalled();
    expect(stop).not.toHaveBeenCalled();
  });

  it('removes the repeatable job and stops the agent', async () => {
    const { service, queue, stop } = setup(null);

    await service.cleanupAndUnregisterAgent(steamid);

    expect(queue.removeRepeatableByKey).toHaveBeenCalledWith('k');
    expect(stop).toHaveBeenCalledWith(token);
  });
});

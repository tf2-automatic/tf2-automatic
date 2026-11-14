import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RedisService } from '@liaoliaots/nestjs-redis';
import { Agent } from '@tf2-automatic/bptf-manager-data';
import { LockDuration } from '@tf2-automatic/locking';
import { Queue } from 'bullmq';
import { pack } from 'msgpackr';
import SteamID from 'steamid';
import { Config } from '../common/config/configuration';
import { TokensService } from '../tokens/tokens.service';
import { AgentsService } from './agents.service';
import { AgentResponse } from './interfaces/agent-response.interface';

const mockUsing = jest.fn();

jest.mock('@tf2-automatic/locking', () => ({
  LockDuration: { SHORT: 0, MEDIUM: 1, LONG: 2 },
  Locker: jest.fn().mockImplementation(() => ({
    using: (...args: unknown[]) => mockUsing(...args),
  })),
}));

describe('AgentsService', () => {
  const steamid = new SteamID('76561198120070906');
  const token = { steamid64: steamid.getSteamID64(), value: 'token' };

  beforeEach(() => {
    mockUsing.mockReset();
    mockUsing.mockImplementation((_r, _d, routine) =>
      routine({ aborted: false }),
    );
  });

  function setup(agent: Agent | null) {
    const redis = {
      hgetBuffer: jest.fn().mockResolvedValue(agent ? pack(agent) : null),
      hvalsBuffer: jest.fn().mockResolvedValue(agent ? [pack(agent)] : []),
      hset: jest.fn(),
    };
    const queue = {
      getJobScheduler: jest.fn().mockResolvedValue(undefined),
      getJobSchedulers: jest.fn().mockResolvedValue([
        // The old repeatable job, keyed by a hash
        { key: 'legacy', name: steamid.getSteamID64() },
        {
          key: 'register_' + steamid.getSteamID64(),
          name: steamid.getSteamID64(),
        },
        { key: 'register_76561198000000000', name: '76561198000000000' },
      ]),
      removeJobScheduler: jest.fn(),
      upsertJobScheduler: jest.fn(),
      getJobs: jest.fn().mockResolvedValue([]),
    };
    const tokensService = { getToken: jest.fn().mockResolvedValue(token) };

    const service = new AgentsService(
      queue as unknown as Queue,
      {} as Queue,
      {} as HttpService,
      tokensService as unknown as TokensService,
      { getOrThrow: () => redis } as unknown as RedisService,
      {
        getOrThrow: () => ({ registerInterval: 300000 }),
      } as unknown as ConfigService<Config>,
      { emitAsync: jest.fn() } as unknown as EventEmitter2,
    );

    const stop = jest
      .spyOn(service, 'unregisterAgent')
      .mockResolvedValue({} as AgentResponse);

    return { service, queue, stop, redis };
  }

  it('skips cleanup when the agent is registered again', async () => {
    const { service, queue, stop } = setup({
      steamid64: steamid.getSteamID64(),
      userAgent: null,
      updatedAt: 0,
    });

    await service.cleanupAndUnregisterAgent(steamid);

    expect(queue.removeJobScheduler).not.toHaveBeenCalled();
    expect(stop).not.toHaveBeenCalled();
  });

  it('removes the schedules and stops the agent', async () => {
    const { service, queue, stop } = setup(null);

    await service.cleanupAndUnregisterAgent(steamid);

    expect(queue.removeJobScheduler.mock.calls).toEqual([
      ['legacy'],
      ['register_' + steamid.getSteamID64()],
    ]);
    expect(stop).toHaveBeenCalledWith(token);
  });

  it('schedules a new agent without an offset so it pulses now', async () => {
    const { service, queue } = setup(null);
    const steamid64 = steamid.getSteamID64();

    await service.enqueueRegisterAgent(steamid, {});

    expect(queue.removeJobScheduler.mock.calls).toEqual([['legacy']]);
    expect(queue.upsertJobScheduler).toHaveBeenCalledWith(
      'register_' + steamid64,
      { every: 300000, offset: undefined },
      { name: steamid64, data: { steamid64 } },
    );
  });

  it('does not reschedule an agent that is already scheduled', async () => {
    const { service, queue } = setup(null);
    queue.getJobScheduler.mockResolvedValue({});

    await service.enqueueRegisterAgent(steamid, {});

    expect(queue.upsertJobScheduler).not.toHaveBeenCalled();
  });

  it('moves agents off the old repeatable job on start', async () => {
    const { service, queue } = setup({
      steamid64: steamid.getSteamID64(),
      userAgent: null,
      updatedAt: 0,
    });

    await service.onModuleInit();

    expect(queue.removeJobScheduler.mock.calls).toEqual([['legacy']]);
    expect(queue.upsertJobScheduler).toHaveBeenCalledWith(
      'register_' + steamid.getSteamID64(),
      { every: 300000, offset: 0 },
      expect.anything(),
    );
  });

  it('leaves agents already on a scheduler alone on start', async () => {
    const { service, queue } = setup({
      steamid64: steamid.getSteamID64(),
      userAgent: null,
      updatedAt: 0,
    });
    queue.getJobScheduler.mockResolvedValue({});

    await service.onModuleInit();

    expect(queue.upsertJobScheduler).not.toHaveBeenCalled();
  });

  it('checks the agent and cleans up under the agent lock', async () => {
    const { service, redis, stop } = setup(null);

    let routine: (signal: { aborted: boolean }) => Promise<void> = () =>
      Promise.resolve();
    mockUsing.mockImplementation((_r, _d, r) => {
      routine = r;
      return Promise.resolve();
    });

    await service.cleanupAndUnregisterAgent(steamid);

    expect(mockUsing).toHaveBeenCalledWith(
      ['agents:' + steamid.getSteamID64()],
      LockDuration.MEDIUM,
      expect.any(Function),
    );
    expect(redis.hgetBuffer).not.toHaveBeenCalled();

    await routine({ aborted: false });

    expect(redis.hgetBuffer).toHaveBeenCalled();
    expect(stop).toHaveBeenCalled();
  });

  it('does not stop the agent when the lock was lost', async () => {
    const { service, stop } = setup(null);
    const error = new Error('lock lost');
    mockUsing.mockImplementation((_r, _d, routine) =>
      routine({ aborted: true, error }),
    );

    await expect(service.cleanupAndUnregisterAgent(steamid)).rejects.toBe(
      error,
    );
    expect(stop).not.toHaveBeenCalled();
  });
});

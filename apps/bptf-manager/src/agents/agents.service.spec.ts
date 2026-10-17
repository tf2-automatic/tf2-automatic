import SteamID from 'steamid';
import { AgentsService } from './agents.service';

jest.mock('@tf2-automatic/locking', () => ({
  LockDuration: { SHORT: 0, MEDIUM: 1, LONG: 2 },
  Locker: jest.fn().mockImplementation(() => ({
    using: jest.fn((_r, _d, routine) => routine({ aborted: false })),
  })),
}));

describe('AgentsService', () => {
  const steamid = new SteamID('76561198120070906');
  const token = { steamid64: steamid.getSteamID64(), value: 'token' };

  function setup(agent: unknown) {
    const queue = { removeRepeatableByKey: jest.fn() };
    const tokensService = { getToken: jest.fn().mockResolvedValue(token) };
    const service = new AgentsService(
      queue as never,
      {} as never,
      {} as never,
      tokensService as never,
      { getOrThrow: jest.fn().mockReturnValue({}) } as never,
      {} as never,
      {} as never,
    );
    jest.spyOn(service, 'getAgent').mockResolvedValue(agent as never);
    jest
      .spyOn(service as never, 'getRepeatableJob')
      .mockResolvedValue({ key: 'k' } as never);
    jest.spyOn(service as never, 'getJobs').mockResolvedValue([] as never);
    const stop = jest
      .spyOn(service, 'unregisterAgent')
      .mockResolvedValue({} as never);
    return { service, queue, stop };
  }

  it('skips cleanup when the agent is registered again', async () => {
    const { service, queue, stop } = setup({ steamid64: 'x' });

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

import Bottleneck from 'bottleneck';
import { ManageListingsProcessor } from './manage-listings.processor';

jest.mock('bottleneck', () => ({
  __esModule: true,
  default: {
    Group: jest.fn().mockImplementation(() => ({
      on: jest.fn(),
      disconnect: jest.fn().mockResolvedValue(undefined),
    })),
  },
}));

describe('ManageListingsProcessor', () => {
  const Group = Bottleneck.Group as unknown as jest.Mock;

  function createProcessor(storedHash: string | null) {
    const redis = {
      get: jest.fn().mockResolvedValue(storedHash),
      set: jest.fn(),
    };

    const processor = new ManageListingsProcessor(
      {} as never,
      {} as never,
      { getOrThrow: () => ({ keyPrefix: 'prefix:' }) } as never,
      {} as never,
      { getOrThrow: () => redis } as never,
    );

    return { processor, redis };
  }

  const clearedGroups = () =>
    Group.mock.calls.filter(([options]) => options.clearDatastore).length;

  it('clears the limiters only when their settings changed', async () => {
    const first = createProcessor(null);
    await first.processor.onModuleInit();

    expect(clearedGroups()).toBe(2);
    const [key, settingsHash] = first.redis.set.mock.calls[0];
    expect(key).toBe('limiters:hash');

    // Restart with the same settings keeps the limiter state
    Group.mockClear();
    const second = createProcessor(settingsHash);
    await second.processor.onModuleInit();

    expect(clearedGroups()).toBe(0);
    expect(second.redis.set).not.toHaveBeenCalled();
  });
});

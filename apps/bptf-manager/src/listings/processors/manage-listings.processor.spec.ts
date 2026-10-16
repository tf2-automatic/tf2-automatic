import Bottleneck from 'bottleneck';
import { AxiosError } from 'axios';
import { ManageListingsProcessor } from './manage-listings.processor';

const mockLimiter = { updateSettings: jest.fn() };

jest.mock('bottleneck', () => ({
  __esModule: true,
  default: {
    Group: jest.fn().mockImplementation(() => ({
      on: jest.fn(),
      disconnect: jest.fn().mockResolvedValue(undefined),
      limiters: () => [{ key: '123:update', limiter: mockLimiter }],
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

  it('follows the rate limit from a 429 response', async () => {
    const { processor } = createProcessor(null);

    const err = new AxiosError('Request failed with status code 429');
    err.response = {
      status: 429,
      data: {
        message: 'Request limit exceeded.',
        maxWindowRequests: 3,
        windowSeconds: 60,
      },
    } as never;

    const internals = processor as unknown as {
      handleBatchError: (key: string, err: Error) => Promise<void>;
    };
    await expect(internals.handleBatchError('123:update', err)).rejects.toBe(
      err,
    );

    expect(mockLimiter.updateSettings).toHaveBeenCalledWith({
      reservoir: 0,
      reservoirIncreaseAmount: 3,
      reservoirIncreaseMaximum: 3,
      reservoirIncreaseInterval: 60000,
    });
  });
});

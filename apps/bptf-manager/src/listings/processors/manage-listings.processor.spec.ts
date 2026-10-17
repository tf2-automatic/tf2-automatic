import Bottleneck from 'bottleneck';
import { AxiosError } from 'axios';
import { DelayedError } from 'bullmq';
import { ManageListingsProcessor } from './manage-listings.processor';

const mockLimiter = { updateSettings: jest.fn() };

jest.mock('bottleneck', () => ({
  __esModule: true,
  default: {
    Group: jest.fn().mockImplementation((options) => ({
      id: options.id,
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
      pttl: jest.fn().mockResolvedValue(-2),
    };

    const config = {
      redis: { keyPrefix: 'prefix:' },
      listings: { batchLimit: 3, batchLimitInterval: 60000 },
    };

    const processor = new ManageListingsProcessor(
      {} as never,
      {} as never,
      { getOrThrow: (key: keyof typeof config) => config[key] } as never,
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

  it('configures the batch limiter from the config', () => {
    Group.mockClear();
    createProcessor(null);

    expect(Group).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'listings:batch',
        minTime: 20000,
        reservoir: 3,
        reservoirIncreaseAmount: 3,
        reservoirIncreaseInterval: 60000,
        reservoirIncreaseMaximum: 3,
      }),
    );
  });

  it('follows the rate limit from a 429 response', async () => {
    const { processor, redis } = createProcessor(null);

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
    expect(redis.set).toHaveBeenCalledWith(
      'ratelimited:listings:batch:123:update',
      1,
      'PX',
      60000,
    );
  });

  it('delays the job instead of waiting when the limiter is busy', async () => {
    const { processor, redis } = createProcessor(null);
    const internals = processor as unknown as {
      scheduleOrDelay: (...args: unknown[]) => Promise<boolean>;
    };

    const job = { name: 'update', data: {}, moveToDelayed: jest.fn() };
    const task = jest.fn().mockResolvedValue(true);
    const limiter = {
      check: jest.fn().mockResolvedValue(false),
      schedule: jest.fn((fn: () => Promise<boolean>) => fn()),
    };
    const group = { id: 'listings:batch', key: () => limiter };
    const run = () =>
      internals.scheduleOrDelay(
        job,
        'lock',
        group,
        '123:update',
        { minTime: 6000 },
        task,
      );
    jest.spyOn(Date, 'now').mockReturnValue(1000);

    // A known rate limit window is waited out in one go
    redis.pttl.mockResolvedValueOnce(45000);
    await expect(run()).rejects.toBeInstanceOf(DelayedError);
    expect(job.moveToDelayed).toHaveBeenLastCalledWith(46000, 'lock');

    // Otherwise a busy limiter delays by its minTime
    await expect(run()).rejects.toBeInstanceOf(DelayedError);
    expect(job.moveToDelayed).toHaveBeenLastCalledWith(7000, 'lock');
    expect(limiter.schedule).not.toHaveBeenCalled();

    limiter.check.mockResolvedValue(true);
    await expect(run()).resolves.toBe(true);

    jest.restoreAllMocks();
  });
});

import Bottleneck from 'bottleneck';
import { AxiosError } from 'axios';
import { DelayedError } from 'bullmq';
import { RateLimitsService } from './rate-limits.service';

const mockLimiter = {
  updateSettings: jest.fn(),
  currentReservoir: jest.fn(),
  schedule: jest.fn((fn: () => Promise<unknown>) => fn()),
};

const mockDeleteKey = jest.fn().mockResolvedValue(true);

jest.mock('bottleneck', () => ({
  __esModule: true,
  default: {
    Group: jest.fn().mockImplementation((options) => ({
      id: options.id,
      on: jest.fn(),
      disconnect: jest.fn().mockResolvedValue(undefined),
      key: () => mockLimiter,
      deleteKey: mockDeleteKey,
      limiters: () => [{ key: '123', limiter: mockLimiter }],
    })),
  },
}));

describe('RateLimitsService', () => {
  const Group = Bottleneck.Group as unknown as jest.Mock;

  function createService(storedHash: string | null) {
    const redis = {
      get: jest.fn().mockResolvedValue(storedHash),
      set: jest.fn(),
      pttl: jest.fn().mockResolvedValue(-2),
    };

    const config = {
      redis: { keyPrefix: 'prefix:' },
      rateLimits: {
        listingsBatch: { requests: 3, window: 60000 },
        archiveBatch: { requests: 10, window: 60000 },
        listingsGet: { requests: 20, window: 60000 },
        archiveGet: { requests: 5, window: 30000 },
        notificationsGet: { requests: 20, window: 60000 },
      },
    };

    const service = new RateLimitsService(
      { getOrThrow: (key: keyof typeof config) => config[key] } as never,
      { getOrThrow: () => redis } as never,
    );

    return { service, redis };
  }

  const clearedGroups = () =>
    Group.mock.calls.filter(([options]) => options.clearDatastore).length;

  it('clears the limiters only when their settings changed', async () => {
    const first = createService(null);
    await first.service.onModuleInit();

    expect(clearedGroups()).toBe(6);
    const [key, settingsHash] = first.redis.set.mock.calls[0];
    expect(key).toBe('limiters:hash');

    // Restart with the same settings keeps the limiter state
    Group.mockClear();
    const second = createService(settingsHash);
    await second.service.onModuleInit();

    expect(clearedGroups()).toBe(0);
    expect(second.redis.set).not.toHaveBeenCalled();
  });

  it('configures a limiter per endpoint from the config', () => {
    Group.mockClear();
    createService(null);

    expect(Group).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'listingsBatch',
        reservoir: 3,
        reservoirIncreaseAmount: 3,
        reservoirIncreaseInterval: 60000,
        reservoirIncreaseMaximum: 3,
      }),
    );
    expect(Group).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'listingsGet', reservoir: 20 }),
    );
    expect(Group).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'archiveGet',
        reservoir: 5,
        reservoirIncreaseInterval: 30000,
      }),
    );
  });

  it('follows the rate limit from a 429 response', async () => {
    const { service, redis } = createService(null);

    const err = new AxiosError('Request failed with status code 429');
    err.response = {
      status: 429,
      data: {
        message: 'Request limit exceeded.',
        maxWindowRequests: 20,
        windowSeconds: 60,
      },
    } as never;

    await expect(service.handleError('listingsGet', '123', err)).rejects.toBe(
      err,
    );

    expect(mockLimiter.updateSettings).toHaveBeenCalledWith({
      reservoir: 0,
      reservoirIncreaseAmount: 20,
      reservoirIncreaseMaximum: 20,
      reservoirIncreaseInterval: 60000,
    });
    expect(redis.set).toHaveBeenCalledWith(
      'ratelimited:listingsGet:123',
      1,
      'PX',
      60000,
    );
  });

  it('delays the job instead of waiting when the limiter is empty', async () => {
    const { service, redis } = createService(null);

    const job = { name: 'archived', data: {}, moveToDelayed: jest.fn() };
    const task = jest.fn().mockResolvedValue(true);
    const run = () =>
      service.scheduleOrDelay(job as never, 'lock', 'archiveGet', '123', task);
    jest.spyOn(Date, 'now').mockReturnValue(1000);
    mockLimiter.currentReservoir.mockResolvedValue(0);

    // A known rate limit window is waited out in one go
    redis.pttl.mockResolvedValueOnce(45000);
    await expect(run()).rejects.toBeInstanceOf(DelayedError);
    expect(job.moveToDelayed).toHaveBeenLastCalledWith(46000, 'lock');

    // An empty reservoir waits for its refill instead of polling
    await expect(run()).rejects.toBeInstanceOf(DelayedError);
    expect(job.moveToDelayed).toHaveBeenLastCalledWith(31000, 'lock');
    expect(mockLimiter.schedule).not.toHaveBeenCalled();

    // Requests left run right away
    mockLimiter.currentReservoir.mockResolvedValue(1);
    await expect(run()).resolves.toBe(true);

    jest.restoreAllMocks();
  });

  it('recreates a limiter whose key expired in Redis', async () => {
    const { service } = createService(null);

    const job = { name: 'active', data: {}, moveToDelayed: jest.fn() };
    const task = jest.fn().mockResolvedValue(true);
    mockLimiter.currentReservoir
      .mockRejectedValueOnce(new Error('ERR SETTINGS_KEY_NOT_FOUND'))
      .mockResolvedValueOnce(20);

    await expect(
      service.scheduleOrDelay(job as never, 'lock', 'listingsGet', '123', task),
    ).resolves.toBe(true);

    expect(mockDeleteKey).toHaveBeenCalledWith('123');
    expect(job.moveToDelayed).not.toHaveBeenCalled();
  });
});

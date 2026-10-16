import Bottleneck from 'bottleneck';
import fs from 'fs';
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

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  readFileSync: jest.fn(),
}));

describe('ManageListingsProcessor', () => {
  const Group = Bottleneck.Group as unknown as jest.Mock;

  async function start(version: string, storedHash: string | null) {
    jest.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ version }));

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

    Group.mockClear();
    await processor.onModuleInit();

    const cleared = Group.mock.calls.filter(
      ([options]) => options.clearDatastore,
    ).length;

    return { cleared, savedHash: redis.set.mock.calls[0]?.[1] };
  }

  it('clears the limiters only when the version or settings changed', async () => {
    const first = await start('1.0.0', null);
    expect(first.cleared).toBe(2);

    // Same version and settings keeps the limiter state
    const restart = await start('1.0.0', first.savedHash);
    expect(restart.cleared).toBe(0);
    expect(restart.savedHash).toBeUndefined();

    const upgrade = await start('1.1.0', first.savedHash);
    expect(upgrade.cleared).toBe(2);
  });
});

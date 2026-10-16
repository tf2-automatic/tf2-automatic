import SteamID from 'steamid';
import { ListingLimitsService } from './listing-limits.service';

describe('ListingLimitsService', () => {
  it('stops waiting for a refresh job that never finishes', async () => {
    const queue = {
      // A refresh job that keeps failing and is never finished
      getJob: jest.fn().mockResolvedValue({ finishedOn: undefined }),
    };

    const service = new ListingLimitsService(
      queue as never,
      { getOrThrow: () => ({}) } as never,
    );

    const start = Date.now();
    await service.waitForRefresh(new SteamID('76561198120070906'), 300);

    expect(Date.now() - start).toBeLessThan(1000);
    expect(queue.getJob.mock.calls.length).toBeGreaterThan(1);
  });
});

import { NotFoundException } from '@nestjs/common';
import SteamID from 'steamid';
import { ListingLimitsService } from './listing-limits.service';

describe('ListingLimitsService', () => {
  it('queues a refresh when no limits are stored', async () => {
    const queue = { add: jest.fn() };
    // Only used is known, e.g. before the first limits refresh finished
    const redis = { hgetall: jest.fn().mockResolvedValue({ used: '1' }) };

    const service = new ListingLimitsService(
      queue as never,
      { getOrThrow: () => redis } as never,
    );

    await expect(
      service.getLimits(new SteamID('76561198120070906')),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(queue.add).toHaveBeenCalledWith(
      'refresh',
      { steamid64: '76561198120070906' },
      { jobId: 'refresh_76561198120070906' },
    );
  });
});

import { mock } from '@tf2-automatic/testing';
import SteamID from 'steamid';
import { NotificationsService } from './notifications.service';

jest.mock('bullmq', () => ({
  ...jest.requireActual('bullmq'),
  FlowProducer: jest.fn(),
}));

describe('NotificationsService', () => {
  const steamid = new SteamID('76561198120070906');

  it('drops notifications removed since the last refresh', async () => {
    const { redis, hashes } = mock.createMemoryRedis();

    const service = new NotificationsService(
      { getOrThrow: () => redis } as never,
      {} as never,
      {} as never,
      { emitAsync: jest.fn() } as never,
    );

    const producer = { add: jest.fn() };
    (service as unknown as { producer: typeof producer }).producer = producer;

    async function refresh(ids: string[]) {
      await service.refreshNotifications(steamid);
      const job = { data: producer.add.mock.lastCall[0].data } as never;

      await service.handleNotifications(job, {
        results: ids.map((id) => ({ id })),
        cursor: { skip: 0, limit: 100, total: ids.length },
      } as never);
      await service.handleNotificationsFetched(job);

      return Array.from(
        hashes.get('notifications:' + steamid.getSteamID64())?.keys() ?? [],
      );
    }

    const now = jest.spyOn(Date, 'now').mockReturnValue(1000);
    expect(await refresh(['A', 'B'])).toEqual(['A', 'B']);

    now.mockReturnValue(2000);
    expect(await refresh(['A'])).toEqual(['A']);

    now.mockRestore();
  });
});

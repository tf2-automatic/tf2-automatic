import { Job, MinimalQueue } from 'bullmq';
import { promoteOfflineBotJobs } from './offline-bots';

describe('promoteOfflineBotJobs', () => {
  afterEach(() => jest.restoreAllMocks());

  it('promotes and clears the flagged jobs of the bot', async () => {
    const promote = jest.fn().mockResolvedValue(undefined);
    const multi = {
      smembers: jest.fn(),
      del: jest.fn(),
      exec: jest.fn().mockResolvedValue([
        [null, ['1', '2', '3']],
        [null, 1],
      ]),
    };
    multi.smembers.mockReturnValue(multi);
    multi.del.mockReturnValue(multi);

    const queue = {
      toKey: (type: string) => 'bull:test:' + type,
      client: Promise.resolve({ multi: () => multi }),
    } as unknown as MinimalQueue;

    jest.spyOn(Job, 'fromId').mockImplementation(async (_, id) => {
      if (id === '3') {
        return undefined;
      }
      // Job 2 is no longer delayed
      return {
        promote:
          id === '2' ? jest.fn().mockRejectedValue(new Error()) : promote,
      } as never;
    });

    await promoteOfflineBotJobs(queue, '76561198120070906');

    expect(multi.smembers).toHaveBeenCalledWith(
      'bull:test:offline-bot:76561198120070906',
    );
    expect(multi.del).toHaveBeenCalledWith(
      'bull:test:offline-bot:76561198120070906',
    );
    expect(promote).toHaveBeenCalledTimes(1);
  });
});

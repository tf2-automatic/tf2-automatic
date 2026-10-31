import { Job, MinimalQueue } from 'bullmq';
import { promoteOfflineBotJobs } from './offline-bots';

const KEY = 'bull:test:offline-bot:76561198120070906';

describe('promoteOfflineBotJobs', () => {
  afterEach(() => jest.restoreAllMocks());

  const makeQueue = (ids: string[]) => {
    const client = {
      smembers: jest.fn().mockResolvedValue(ids),
      runCommand: jest.fn().mockResolvedValue(1),
    };
    const queue = {
      toKey: (type: string) => 'bull:test:' + type,
      client: Promise.resolve(client),
    } as unknown as MinimalQueue;
    return { queue, client };
  };

  it('promotes the flagged jobs and unflags them', async () => {
    const { queue, client } = makeQueue(['1', '2', '3']);
    const promote = jest.fn().mockResolvedValue(undefined);

    jest.spyOn(Job, 'fromId').mockImplementation(async (_, id) => {
      if (id === '3') {
        return undefined;
      }
      return {
        promote:
          id === '2'
            ? jest
                .fn()
                .mockRejectedValue(
                  new Error('Job 2 is not in the delayed state. promote'),
                )
            : promote,
      } as never;
    });

    await promoteOfflineBotJobs(queue, '76561198120070906');

    expect(client.smembers).toHaveBeenCalledWith(KEY);
    expect(promote).toHaveBeenCalledTimes(1);
    expect(client.runCommand).toHaveBeenCalledTimes(3);
    expect(client.runCommand).toHaveBeenCalledWith('srem', [KEY, '1']);
  });

  it('keeps the flag when promoting fails unexpectedly', async () => {
    const { queue, client } = makeQueue(['1']);

    jest.spyOn(Job, 'fromId').mockResolvedValue({
      promote: jest.fn().mockRejectedValue(new Error('Connection is closed')),
    } as never);

    await expect(
      promoteOfflineBotJobs(queue, '76561198120070906'),
    ).rejects.toThrow('Connection is closed');

    expect(client.runCommand).not.toHaveBeenCalled();
  });
});

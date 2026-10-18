import { NotFoundException } from '@nestjs/common';
import { HeartbeatsProcessor } from './heartbeats.processor';

const steamid64 = '76561197960287930';

function setup(error: Error, attemptsMade: number) {
  const service = {
    getBot: jest.fn().mockRejectedValue(error),
    markStopped: jest.fn().mockResolvedValue(undefined),
  };
  const processor = new HeartbeatsProcessor(service as never);
  const job = {
    data: { steamid64, lastSeen: 1 },
    attemptsMade,
    opts: { attempts: 3 },
  };
  return { service, run: () => processor.process(job as never) };
}

describe('HeartbeatsProcessor', () => {
  const networkError = (code: string) =>
    Object.assign(new Error('x'), { code });

  it.each(['ECONNABORTED', 'ETIMEDOUT', 'EHOSTUNREACH'])(
    'marks the bot stopped on %s on the final attempt',
    async (code) => {
      const { service, run } = setup(networkError(code), 2);

      await run();

      expect(service.markStopped).toHaveBeenCalledTimes(1);
    },
  );

  it('rethrows network errors on a non-final attempt', async () => {
    const { service, run } = setup(networkError('ETIMEDOUT'), 1);

    await expect(run()).rejects.toThrow('x');
    expect(service.markStopped).not.toHaveBeenCalled();
  });

  it('does nothing when the bot is not found', async () => {
    const { service, run } = setup(new NotFoundException(), 2);

    await run();

    expect(service.markStopped).not.toHaveBeenCalled();
  });
});

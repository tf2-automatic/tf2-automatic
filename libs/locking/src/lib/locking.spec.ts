import { Redis } from 'ioredis';
import Redlock from 'redlock';
import { LockDuration, Locker } from './locking';

jest.mock('redlock');

describe('Locker', () => {
  it('should lock each resource once', async () => {
    const locker = new Locker({} as Redis);
    const routine = jest.fn();

    await locker.using(['a', 'b', 'a'], LockDuration.SHORT, routine);

    const redlock = jest.mocked(Redlock).mock.instances[0];
    expect(redlock.using).toHaveBeenCalledWith(
      ['locking:a', 'locking:b'],
      2000,
      routine,
    );
  });
});

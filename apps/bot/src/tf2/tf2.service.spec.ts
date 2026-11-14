import { EventEmitter } from 'events';
import { TF2_LOST_EVENT } from '@tf2-automatic/bot-data';
import { TF2Service } from './tf2.service';

jest.mock('tf2', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { EventEmitter } = require('events');
  return {
    __esModule: true,
    default: class extends EventEmitter {
      backpack = [{ id: '1' }];
      useItem = jest.fn();
      deleteItem = jest.fn();
    },
  };
});

describe('TF2Service', () => {
  let service: TF2Service;
  let tf2: EventEmitter;
  let publish: jest.Mock;
  let bot: {
    getClient: () => EventEmitter;
    joinGame: jest.Mock;
    exitGame: jest.Mock;
  };

  beforeEach(() => {
    jest.useFakeTimers();
    publish = jest.fn().mockResolvedValue(undefined);
    const client = Object.assign(new EventEmitter(), { _playingAppIds: [440] });
    bot = {
      getClient: () => client,
      joinGame: jest.fn(),
      exitGame: jest.fn(),
    };
    service = new TF2Service(bot as never, { publish } as never);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tf2 = (service as any).tf2;
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it.each([
    ['deleteItem', 'processDeleteItem'],
    ['useItem', 'processUseItem'],
  ])('%s ignores itemRemoved(null) while pending', async (_, method) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const promise = (service as any)[method]('1') as Promise<void>;

    expect(() => tf2.emit('itemRemoved', null)).not.toThrow();
    tf2.emit('itemRemoved', { id: '1' });

    await expect(promise).resolves.toBeUndefined();
  });

  it('does not publish TF2_LOST_EVENT for a null item', () => {
    tf2.emit('itemRemoved', null);
    expect(publish).not.toHaveBeenCalled();

    tf2.emit('itemRemoved', { id: '1' });
    expect(publish).toHaveBeenCalledWith(TF2_LOST_EVENT, { id: '1' });
  });

  describe('inventory refresh', () => {
    beforeEach(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (tf2 as any).haveGCSession = true;
    });

    it('waits for a running task before reconnecting to the GC', async () => {
      tf2.emit('itemAcquired', { id: '2' });
      await jest.advanceTimersByTimeAsync(5000);

      const deleted = service.deleteItem('1');
      await jest.advanceTimersByTimeAsync(5000);

      // Refresh is due, but the delete is still waiting on the GC
      expect(bot.exitGame).not.toHaveBeenCalled();

      tf2.emit('itemRemoved', { id: '1' });
      await expect(deleted).resolves.toBeUndefined();
      await jest.advanceTimersByTimeAsync(0);

      expect(bot.exitGame).toHaveBeenCalledWith(440);
      tf2.emit('backpackLoaded');
    });

    it('queues one refresh at a time', async () => {
      const deleted = service.deleteItem('1');
      await jest.advanceTimersByTimeAsync(0);

      tf2.emit('itemAcquired', { id: '2' });
      await jest.advanceTimersByTimeAsync(1000);
      tf2.emit('itemAcquired', { id: '3' });
      await jest.advanceTimersByTimeAsync(10000);

      tf2.emit('itemRemoved', { id: '1' });
      await deleted.catch(() => undefined);
      await jest.advanceTimersByTimeAsync(0);
      tf2.emit('backpackLoaded');
      await jest.advanceTimersByTimeAsync(0);

      expect(bot.exitGame).toHaveBeenCalledTimes(1);
    });
  });

  describe('event waiting', () => {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const waitForEvent = (...args: unknown[]) =>
      (service as any).waitForEvent(...args) as Promise<unknown[]>;
    const waitForNoEvent = (...args: unknown[]) =>
      (service as any).waitForNoEvent(...args) as Promise<void>;
    /* eslint-enable @typescript-eslint/no-explicit-any */

    const counts = () => [
      tf2.listenerCount('foo'),
      tf2.listenerCount('disconnectedFromGC'),
    ];

    it('waitForEvent resolves on a matching event and cleans up', async () => {
      const base = tf2.listenerCount('disconnectedFromGC');
      const promise = waitForEvent('foo', ([id]: unknown[]) => id === 2);

      tf2.emit('foo', 1);
      expect(counts()).toEqual([1, base + 1]);
      tf2.emit('foo', 2, 'x');

      await expect(promise).resolves.toEqual([2, 'x']);
      expect(counts()).toEqual([0, base]);
    });

    it('waitForEvent times out after 10s and cleans up', async () => {
      const base = tf2.listenerCount('disconnectedFromGC');
      const promise = waitForEvent('foo');
      const assertion = expect(promise).rejects.toThrow(
        'Timed out waiting for event',
      );

      jest.advanceTimersByTime(9999);
      expect(counts()).toEqual([1, base + 1]);
      jest.advanceTimersByTime(1);

      await assertion;
      expect(counts()).toEqual([0, base]);
    });

    it('waitForEvent rejects on disconnect and cleans up', async () => {
      const base = tf2.listenerCount('disconnectedFromGC');
      const promise = waitForEvent('foo');

      tf2.emit('disconnectedFromGC');

      await expect(promise).rejects.toThrow('Disconnected from GC');
      expect(counts()).toEqual([0, base]);
    });

    it('waitForEvent can wait for disconnectedFromGC itself', async () => {
      const base = tf2.listenerCount('disconnectedFromGC');
      const promise = waitForEvent('disconnectedFromGC');

      expect(tf2.listenerCount('disconnectedFromGC')).toBe(base + 1);
      tf2.emit('disconnectedFromGC');

      await expect(promise).resolves.toEqual([]);
      expect(tf2.listenerCount('disconnectedFromGC')).toBe(base);
    });

    it('waitForNoEvent resolves after a quiet period, reset by matches', async () => {
      const base = tf2.listenerCount('disconnectedFromGC');
      const done = jest.fn();
      const promise = waitForNoEvent('foo', 1000).then(done);

      jest.advanceTimersByTime(900);
      tf2.emit('foo');
      jest.advanceTimersByTime(900);
      await Promise.resolve();
      expect(done).not.toHaveBeenCalled();
      expect(counts()).toEqual([1, base + 1]);

      jest.advanceTimersByTime(100);
      await promise;
      expect(done).toHaveBeenCalled();
      expect(counts()).toEqual([0, base]);
    });

    it('waitForNoEvent ignores non-matching events', async () => {
      const promise = waitForNoEvent(
        'foo',
        1000,
        ([id]: unknown[]) => id === 1,
      );

      jest.advanceTimersByTime(900);
      tf2.emit('foo', 2);
      jest.advanceTimersByTime(100);

      await expect(promise).resolves.toBeUndefined();
    });

    it('waitForNoEvent rejects on disconnect and cleans up', async () => {
      const base = tf2.listenerCount('disconnectedFromGC');
      const promise = waitForNoEvent('foo', 1000);

      tf2.emit('disconnectedFromGC');

      await expect(promise).rejects.toThrow('Disconnected from GC');
      expect(counts()).toEqual([0, base]);
      jest.advanceTimersByTime(5000);
    });
  });
});

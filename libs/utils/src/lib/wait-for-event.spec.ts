import { EventEmitter } from 'events';
import { waitForEvent } from './wait-for-event';

describe('waitForEvent', () => {
  let emitter: EventEmitter;

  const listeners = () =>
    emitter.listenerCount('ev') + emitter.listenerCount('bad');

  const settled = async (promise: Promise<unknown>) => {
    let state = 'pending';
    promise.then(
      () => (state = 'resolved'),
      () => (state = 'rejected'),
    );
    await Promise.resolve();
    await Promise.resolve();
    return state;
  };

  beforeEach(() => {
    jest.useFakeTimers();
    emitter = new EventEmitter();
  });

  afterEach(() => jest.useRealTimers());

  it('resolves with the event args', async () => {
    const promise = waitForEvent(emitter, 'ev', { timeout: 1000 });
    emitter.emit('ev', 1, 'a');
    await expect(promise).resolves.toEqual([1, 'a']);
    expect(listeners()).toBe(0);
  });

  it('ignores non-matching emits and spreads args to the filter', async () => {
    const filter = jest.fn((a: number, b: number) => a === 2 && b === 3);
    const promise = waitForEvent(emitter, 'ev', { timeout: 1000, filter });
    emitter.emit('ev', 1, 3);
    expect(await settled(promise)).toBe('pending');
    expect(listeners()).toBe(1);
    emitter.emit('ev', 2, 3);
    await expect(promise).resolves.toEqual([2, 3]);
    expect(filter).toHaveBeenCalledWith(1, 3);
    expect(listeners()).toBe(0);
  });

  describe('timeout', () => {
    it('rejects only once the timeout is reached', async () => {
      const promise = waitForEvent(emitter, 'ev', { timeout: 1000 });
      const assertion = expect(promise).rejects.toThrow(
        'Timed out waiting for event',
      );
      jest.advanceTimersByTime(999);
      expect(await settled(promise)).toBe('pending');
      jest.advanceTimersByTime(1);
      await assertion;
      expect(listeners()).toBe(0);
    });

    it('uses a custom message', async () => {
      const promise = waitForEvent(emitter, 'ev', {
        timeout: 10,
        timeoutError: 'Timeout',
      });
      const assertion = expect(promise).rejects.toThrow('Timeout');
      jest.advanceTimersByTime(10);
      await assertion;
    });

    it('clears the timer on resolve', async () => {
      const promise = waitForEvent(emitter, 'ev', { timeout: 1000 });
      emitter.emit('ev');
      await promise;
      expect(jest.getTimerCount()).toBe(0);
    });
  });

  describe('rejectOn', () => {
    const rejectOn = { event: 'bad', error: 'Went bad' };

    it('rejects when the other event fires first', async () => {
      const promise = waitForEvent(emitter, 'ev', { timeout: 1000, rejectOn });
      emitter.emit('bad');
      await expect(promise).rejects.toThrow('Went bad');
      expect(listeners()).toBe(0);
      expect(jest.getTimerCount()).toBe(0);
    });

    it('removes the rejectOn listener on resolve and timeout', async () => {
      const promise = waitForEvent(emitter, 'ev', { timeout: 1000, rejectOn });
      emitter.emit('ev');
      await promise;
      expect(listeners()).toBe(0);

      const timedOut = waitForEvent(emitter, 'ev', { timeout: 5, rejectOn });
      const assertion = expect(timedOut).rejects.toThrow();
      jest.advanceTimersByTime(5);
      await assertion;
      expect(listeners()).toBe(0);
    });

    it('is skipped when it equals the awaited event', async () => {
      const promise = waitForEvent(emitter, 'ev', {
        timeout: 1000,
        rejectOn: { event: 'ev', error: 'Went bad' },
      });
      expect(emitter.listenerCount('ev')).toBe(1);
      emitter.emit('ev', 'x');
      await expect(promise).resolves.toEqual(['x']);
      expect(listeners()).toBe(0);
    });
  });

  describe('quiet', () => {
    it('resolves with [] after the quiet period', async () => {
      const promise = waitForEvent(emitter, 'ev', {
        timeout: 1000,
        quiet: true,
      });
      jest.advanceTimersByTime(1000);
      await expect(promise).resolves.toEqual([]);
      expect(listeners()).toBe(0);
    });

    it('restarts the timer on each match', async () => {
      const promise = waitForEvent(emitter, 'ev', {
        timeout: 1000,
        quiet: true,
      });
      jest.advanceTimersByTime(900);
      emitter.emit('ev');
      jest.advanceTimersByTime(900);
      expect(await settled(promise)).toBe('pending');
      expect(listeners()).toBe(1);
      jest.advanceTimersByTime(100);
      await expect(promise).resolves.toEqual([]);
      expect(listeners()).toBe(0);
    });

    it('does not restart on non-matching emits', async () => {
      const promise = waitForEvent(emitter, 'ev', {
        timeout: 1000,
        quiet: true,
        filter: (a) => a === 1,
      });
      jest.advanceTimersByTime(900);
      emitter.emit('ev', 2);
      jest.advanceTimersByTime(100);
      await expect(promise).resolves.toEqual([]);
    });

    it('still rejects on rejectOn', async () => {
      const promise = waitForEvent(emitter, 'ev', {
        timeout: 1000,
        quiet: true,
        rejectOn: { event: 'bad', error: 'Went bad' },
      });
      emitter.emit('bad');
      await expect(promise).rejects.toThrow('Went bad');
      expect(listeners()).toBe(0);
      expect(jest.getTimerCount()).toBe(0);
    });
  });
});

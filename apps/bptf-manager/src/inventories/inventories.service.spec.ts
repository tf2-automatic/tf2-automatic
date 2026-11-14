import SteamID from 'steamid';
import { pack } from 'msgpackr';
import { InventoriesService } from './inventories.service';

const steamid = new SteamID('76561198000000000');
const id = steamid.getSteamID64();

describe('InventoriesService', () => {
  let store: Map<string, string | Buffer>;
  let jobs: { inventories: unknown[]; enqueue: unknown[] };
  let inventoriesQueue: { add: jest.Mock; getJobs: jest.Mock };
  let enqueueQueue: { add: jest.Mock; getJobs: jest.Mock };
  let service: InventoriesService;

  const makeQueue = (list: () => unknown[]) => ({
    add: jest.fn(),
    getJobs: jest.fn((_types, start: number) =>
      Promise.resolve(start === 0 ? list() : []),
    ),
  });

  const makeJob = () => ({ data: { steamid64: id }, remove: jest.fn() });

  const status = (timestamp: number) =>
    ({ timestamp, current_time: 1000, next_update: 1000 }) as never;

  const saveInventory = (timestamp: number, refresh: number) =>
    store.set(
      'inventories:' + id,
      pack({ status: status(timestamp), refresh }),
    );

  const point = () => store.get('inventories:refresh:' + id);

  const data = {
    steamid64: id,
    attempts: 0,
    attemptsSinceLastRefresh: 0,
    refreshed: 0,
  };

  beforeEach(() => {
    store = new Map();
    jobs = { inventories: [], enqueue: [] };
    inventoriesQueue = makeQueue(() => jobs.inventories);
    enqueueQueue = makeQueue(() => jobs.enqueue);

    const redis = {
      get: jest.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
      getBuffer: jest.fn((key: string) =>
        Promise.resolve(store.get(key) ?? null),
      ),
      set: jest.fn((key: string, value: number) => {
        store.set(key, String(value));
        return Promise.resolve();
      }),
      del: jest.fn((key: string) => {
        store.delete(key);
        return Promise.resolve();
      }),
    };

    service = new InventoriesService(
      inventoriesQueue as never,
      enqueueQueue as never,
      {} as never,
      { getOrThrow: () => redis } as never,
    );

    // Run the routine without a real lock
    (service as never as { locker: unknown }).locker = {
      using: (
        _keys: string[],
        _duration: number,
        fn: (s: unknown) => unknown,
      ) => fn({ aborted: false }),
    };
  });

  describe('continueRefresh', () => {
    it('stops when the refresh point is missing', async () => {
      const result = await service.continueRefresh(
        steamid,
        status(500),
        { status: status(500), refresh: 500 },
        data,
      );

      expect(result).toMatchObject({ done: true, cancelled: true });
      expect(inventoriesQueue.add).not.toHaveBeenCalled();
    });

    it('deletes the refresh point when done', async () => {
      store.set('inventories:refresh:' + id, '50');

      const result = await service.continueRefresh(
        steamid,
        status(500),
        { status: status(500), refresh: 100 },
        data,
      );

      expect(result).toMatchObject({ done: true });
      expect(point()).toBeUndefined();
      expect(inventoriesQueue.add).not.toHaveBeenCalled();
    });

    it('continues when a refresh arrived before the decision', async () => {
      store.set('inventories:refresh:' + id, '50');
      jobs.inventories = [makeJob()];
      await service.scheduleRefresh(steamid, { time: 200 });

      const result = await service.continueRefresh(
        steamid,
        status(500),
        { status: status(500), refresh: 100 },
        data,
      );

      expect(point()).toBe('200');
      expect(result).toMatchObject({ done: false });
      expect(inventoriesQueue.add).toHaveBeenCalledTimes(1);
    });
  });

  describe('scheduleRefresh', () => {
    it('starts a new chain after a finished one', async () => {
      await service.scheduleRefresh(steamid, { time: 200 });

      expect(point()).toBe('200');
      expect(enqueueQueue.add).toHaveBeenCalledTimes(1);
    });

    it('starts a chain when the point exists but there are no jobs', async () => {
      store.set('inventories:refresh:' + id, '100');

      await service.scheduleRefresh(steamid, { time: 200 });

      expect(point()).toBe('200');
      expect(enqueueQueue.add).toHaveBeenCalledTimes(1);
    });

    it('only raises the point when a chain is running', async () => {
      store.set('inventories:refresh:' + id, '300');
      jobs.enqueue = [makeJob()];

      await service.scheduleRefresh(steamid, { time: 200 });

      expect(point()).toBe('300');
      expect(enqueueQueue.add).not.toHaveBeenCalled();
    });

    it('skips when the snapshot is already newer', async () => {
      saveInventory(300, 300);

      await service.scheduleRefresh(steamid, { time: 200 });

      expect(point()).toBeUndefined();
      expect(enqueueQueue.add).not.toHaveBeenCalled();
    });
  });

  describe('dequeueRefresh', () => {
    it('deletes the point and removes jobs from both queues', async () => {
      store.set('inventories:refresh:' + id, '100');
      const a = makeJob();
      const b = makeJob();
      jobs.inventories = [a];
      jobs.enqueue = [b];

      await service.dequeueRefresh(steamid);

      expect(point()).toBeUndefined();
      expect(a.remove).toHaveBeenCalled();
      expect(b.remove).toHaveBeenCalled();
    });
  });
});

import { HeartbeatsService } from './heartbeats.service';
import { HeartbeatsProcessor } from './heartbeats.processor';
import { pack, unpack } from 'msgpackr';
import { from, of, throwError } from 'rxjs';
import SteamID from 'steamid';
import { mock } from '@tf2-automatic/testing';

jest.mock('@tf2-automatic/locking', () => ({
  LockDuration: { SHORT: 1 },
  Locker: class {
    using(_k: string[], _d: number, fn: (s: unknown) => unknown) {
      return fn({ aborted: false });
    }
  },
}));

const ID = '76561197960287930';
const KEY = `bots:${ID}`;
const heartbeat = { host: 'h', port: 1, interval: 1000 } as never;

describe('HeartbeatsService', () => {
  let store: Map<string, Buffer>;
  let http: { get: jest.Mock };
  let queue: { getJob: jest.Mock; add: jest.Mock };
  let service: HeartbeatsService;

  const seed = (lastSeen: number) =>
    store.set(
      KEY,
      pack({
        steamid64: ID,
        host: 'h',
        port: 1,
        interval: 1000,
        running: true,
        lastSeen,
      }),
    );

  beforeEach(() => {
    const { redis, strings } = mock.createMemoryRedis();
    store = strings;
    http = { get: jest.fn() };
    queue = { getJob: jest.fn().mockResolvedValue(undefined), add: jest.fn() };
    service = new HeartbeatsService(
      { getOrThrow: () => redis } as never,
      http as never,
      queue as never,
      { publishEvent: jest.fn() } as never,
    );
  });

  afterEach(() => jest.restoreAllMocks());

  it('keeps the bot running when a heartbeat lands during the probe', async () => {
    seed(100);
    let release!: () => void;
    const probe = new Promise(
      (r) => (release = () => r({ data: { steamid64: ID } })),
    );
    // First probe (getBot) is held open, later probes succeed
    http.get.mockReturnValueOnce(from(probe));
    http.get.mockReturnValue(of({ data: { steamid64: ID } }));
    jest.spyOn(Date, 'now').mockReturnValue(200_000);

    const processor = new HeartbeatsProcessor(service);
    const done = processor.process({
      data: { steamid64: ID, lastSeen: 100 },
    } as never);
    await new Promise((r) => setImmediate(r));
    await service.saveBot(new SteamID(ID), heartbeat);
    release();
    await done;

    expect(unpack(store.get(KEY) as Buffer).running).toBe(true);
  });

  it('does not remove the existing job when saveBot fails', async () => {
    seed(100);
    const remove = jest.fn().mockResolvedValue(undefined);
    queue.getJob.mockResolvedValue({ remove });
    http.get.mockReturnValue(throwError(() => ({ code: 'ECONNREFUSED' })));

    await expect(service.saveBot(new SteamID(ID), heartbeat)).rejects.toThrow();

    expect(remove).not.toHaveBeenCalled();
  });

  it('markStopped leaves the bot running when lastSeen differs', async () => {
    seed(100);

    await service.markStopped(new SteamID(ID), false, 99);

    expect(unpack(store.get(KEY) as Buffer).running).toBe(true);
  });
});

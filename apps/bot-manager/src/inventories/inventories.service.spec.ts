import { InventoriesService } from './inventories.service';
import { pack } from 'msgpackr';
import SteamID from 'steamid';

jest.mock('@tf2-automatic/locking', () => ({
  LockDuration: { SHORT: 1 },
  Locker: class {
    using(_keys: string[], _d: number, fn: (s: unknown) => unknown) {
      return fn({ aborted: false });
    }
  },
}));

jest.mock('@tf2-automatic/queue', () => ({
  QueueManagerWithEvents: class {},
  CustomWorkerHost: class {
    logger = { debug: jest.fn() };
  },
  bullWorkerSettings: {},
  selectBot: jest.fn(),
  botAttemptErrorHandler: jest.fn(),
  errorToEvent: jest.fn(),
  CustomUnrecoverableError: class {},
}));

type Hash = Map<string, Buffer | string>;

// Minimal in-memory hash store
function createFakeRedis() {
  const store = new Map<string, Hash>();
  return {
    store,
    exists: async (key: string) => (store.has(key) ? 1 : 0),
    hmgetBuffer: async (key: string, ...fields: string[]) =>
      fields.map((f) => (store.get(key)?.get(f) as Buffer) ?? null),
    multi: () => {
      const ops: (() => void)[] = [];
      const hash = (key: string) => {
        const h: Hash = store.get(key) ?? new Map();
        store.set(key, h);
        return h;
      };
      const m = {
        del: (key: string) => {
          ops.push(() => store.delete(key));
          return m;
        },
        hset: (key: string, obj: Record<string, Buffer | string>) => {
          ops.push(() =>
            Object.entries(obj).forEach(([f, v]) => hash(key).set(f, v)),
          );
          return m;
        },
        hmset: (key: string, ...args: (Buffer | string)[]) => {
          ops.push(() => {
            for (let i = 0; i < args.length; i += 2) {
              hash(key).set(args[i] as string, args[i + 1]);
            }
          });
          return m;
        },
        hdel: (key: string, ...fields: string[]) => {
          ops.push(() => fields.forEach((f) => store.get(key)?.delete(f)));
          return m;
        },
        expire: () => m,
        exec: async () => ops.forEach((op) => op()),
      };
      return m;
    },
  };
}

const item = (assetid: string) => ({
  assetid,
  id: assetid,
  appid: 440,
  contextid: '2',
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Priv = any;

describe('InventoriesService', () => {
  let service: InventoriesService;
  let redis: ReturnType<typeof createFakeRedis>;

  const ours = new SteamID('76561198000000001').getSteamID64();
  const theirs = new SteamID('76561198000000002').getSteamID64();
  const keyOf = (steamid64: string) => `inventory:${steamid64}:440:2`;

  beforeEach(() => {
    redis = createFakeRedis();
    service = new InventoriesService(
      { getOrThrow: () => redis } as never,
      {} as never,
      {} as never,
      {} as never,
      { publishEvent: jest.fn() } as never,
      {} as never,
    );
  });

  const exchangeEvent = (details: object) =>
    ({
      metadata: { steamid64: ours },
      data: {
        offer: { partner: theirs },
        details: { receivedItems: [], sentItems: [], ...details },
      },
    }) as never;

  it('removes the old assetid from the sender when an item moves', async () => {
    // Item received by us, so the old id lived in the partner's inventory
    redis.store.set(keyOf(theirs), new Map([['item:1', pack(item('1'))]]));
    redis.store.set(keyOf(ours), new Map());

    await (service as Priv).handleAddInventoryItems(
      exchangeEvent({ receivedItems: [{ ...item('1'), new_assetid: '2' }] }),
    );

    expect(redis.store.get(keyOf(theirs))?.has('item:1')).toBe(false);
    expect(redis.store.get(keyOf(ours))?.has('item:2')).toBe(true);
  });

  it('removes the traded assetid from the receiver on rollback', async () => {
    // We received item 1 as 2, then it was rolled back to the partner as 3
    redis.store.set(keyOf(ours), new Map([['item:2', pack(item('2'))]]));
    redis.store.set(keyOf(theirs), new Map());

    await (service as Priv).handleAddInventoryItems(
      exchangeEvent({
        receivedItems: [
          { ...item('1'), new_assetid: '2', rollback_new_assetid: '3' },
        ],
      }),
    );

    expect(redis.store.get(keyOf(ours))?.has('item:2')).toBe(false);
    expect(redis.store.get(keyOf(theirs))?.has('item:3')).toBe(true);
  });
});

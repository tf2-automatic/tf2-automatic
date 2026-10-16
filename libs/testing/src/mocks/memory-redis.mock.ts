type Command = (...args: never[]) => unknown;

// In-memory Redis for hashes and sets. Like ioredis with a keyPrefix, keys are
// prefixed except KEYS patterns.
export function createMemoryRedis(keyPrefix = '') {
  const hashes = new Map<string, Map<string, Buffer>>();
  const sets = new Map<string, Set<string>>();

  const commands = {
    hmset: (key: string, values: Record<string, Buffer>) => {
      const hash = hashes.get(keyPrefix + key) ?? new Map();
      Object.entries(values).forEach(([field, value]) =>
        hash.set(field, value),
      );
      hashes.set(keyPrefix + key, hash);
    },
    hdel: (key: string, ...fields: string[]) => {
      fields.forEach((field) => hashes.get(keyPrefix + key)?.delete(field));
    },
    expire: () => undefined,
    persist: () => undefined,
    sadd: (key: string, ...members: string[]) => {
      const set = sets.get(keyPrefix + key) ?? new Set();
      members.forEach((member) => set.add(member));
      sets.set(keyPrefix + key, set);
    },
    srem: (key: string, ...members: string[]) => {
      members.forEach((member) => sets.get(keyPrefix + key)?.delete(member));
    },
    copy: (source: string, destination: string) => {
      hashes.set(
        keyPrefix + destination,
        new Map(hashes.get(keyPrefix + source)),
      );
    },
    del: (key: string) => {
      hashes.delete(keyPrefix + key);
      sets.delete(keyPrefix + key);
    },
  };

  const redis = {
    ...commands,
    keys: async (pattern: string) => {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      return [...hashes.keys(), ...sets.keys()].filter((key) =>
        regex.test(key),
      );
    },
    smembers: async (key: string) =>
      Array.from(sets.get(keyPrefix + key) ?? []),
    exists: async (key: string) =>
      hashes.has(keyPrefix + key) || sets.has(keyPrefix + key) ? 1 : 0,
    multi: () => {
      const queued: (() => void)[] = [];
      const transaction: Record<string, unknown> = {
        exec: async () => queued.forEach((command) => command()),
      };
      Object.entries(commands).forEach(([name, command]) => {
        transaction[name] = (...args: never[]) => {
          queued.push(() => (command as Command)(...args));
          return transaction;
        };
      });
      return transaction;
    },
  };

  return { redis, hashes, sets };
}

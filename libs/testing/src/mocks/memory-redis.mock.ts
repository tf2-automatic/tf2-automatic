type Command = (...args: never[]) => unknown;

// In-memory Redis for hashes, sets and strings. Like ioredis with a keyPrefix, keys are
// prefixed except KEYS patterns.
export function createMemoryRedis(keyPrefix = '') {
  const hashes = new Map<string, Map<string, Buffer>>();
  const sets = new Map<string, Set<string>>();
  const strings = new Map<string, Buffer>();

  const commands = {
    // Takes an object or field/value pairs, like ioredis
    hmset: (
      key: string,
      ...args: [Record<string, Buffer>] | (string | Buffer)[]
    ) => {
      const hash = hashes.get(keyPrefix + key) ?? new Map();
      const entries =
        args.length === 1
          ? Object.entries(args[0] as Record<string, Buffer>)
          : Array.from({ length: args.length / 2 }, (_, i) => [
              args[i * 2] as string,
              args[i * 2 + 1] as Buffer,
            ]);
      entries.forEach(([field, value]) => hash.set(field, value));
      hashes.set(keyPrefix + key, hash);
    },
    hdel: (key: string, ...fields: string[]) => {
      fields.forEach((field) => hashes.get(keyPrefix + key)?.delete(field));
    },
    hset: (key: string, fields: Record<string, Buffer>) =>
      commands.hmset(key, fields),
    set: (key: string, value: Buffer) => {
      strings.set(keyPrefix + key, value);
    },
    // Expiry is not tracked
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
      strings.delete(keyPrefix + key);
    },
  };

  const redis = {
    ...commands,
    keys: async (pattern: string) => {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      return [...hashes.keys(), ...sets.keys(), ...strings.keys()].filter(
        (key) => regex.test(key),
      );
    },
    hmgetBuffer: async (key: string, ...fields: string[]) =>
      fields.map((field) => hashes.get(keyPrefix + key)?.get(field) ?? null),
    getBuffer: async (key: string) => strings.get(keyPrefix + key) ?? null,
    hgetallBuffer: async (key: string) =>
      Object.fromEntries(hashes.get(keyPrefix + key) ?? []),
    // -1 for existing keys because expiry is not tracked
    ttl: async (key: string) =>
      hashes.has(keyPrefix + key) ||
      sets.has(keyPrefix + key) ||
      strings.has(keyPrefix + key)
        ? -1
        : -2,
    smembers: async (key: string) =>
      Array.from(sets.get(keyPrefix + key) ?? []),
    exists: async (key: string) =>
      hashes.has(keyPrefix + key) ||
      sets.has(keyPrefix + key) ||
      strings.has(keyPrefix + key)
        ? 1
        : 0,
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

  return { redis, hashes, sets, strings };
}

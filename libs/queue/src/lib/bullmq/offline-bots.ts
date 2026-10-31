import { DelayedError, Job, MinimalQueue } from 'bullmq';
import SteamID from 'steamid';

// Jobs for an offline bot wait this long unless the bot comes back first
export const OFFLINE_BOT_DELAY = 60 * 1000;

// Provided by the app to tell the queues which bots are offline
export abstract class BotStatus {
  abstract isBotOffline(steamid: SteamID): Promise<boolean>;
}

type KeyedQueue = Pick<MinimalQueue, 'toKey' | 'client'>;

function getKey(queue: KeyedQueue, bot: string): string {
  return queue.toKey('offline-bot:' + bot);
}

export async function delayJobForOfflineBot(
  queue: KeyedQueue,
  job: Job,
  bot: string,
  token: string,
  delay: number,
): Promise<never> {
  // Delay before flagging so a promote never misses a flagged job
  await job.moveToDelayed(Date.now() + delay, token);

  const key = getKey(queue, bot);
  const client = await queue.client;
  // Expires so bots that never come back don't leave sets behind
  await client
    .multi()
    .runCommand('sadd', [key, job.id])
    .runCommand('pexpire', [key, OFFLINE_BOT_DELAY * 2])
    .exec();

  throw new DelayedError();
}

export async function promoteOfflineBotJobs(
  queue: MinimalQueue,
  bot: string,
): Promise<void> {
  const key = getKey(queue, bot);
  const client = await queue.client;
  const ids = await client.smembers(key);

  await Promise.all(
    ids.map(async (id) => {
      const job = await Job.fromId(queue, id);
      await job?.promote().catch((err) => {
        if (!isGoneFromDelayed(err)) {
          throw err;
        }
      });
      // Unflag only once handled so a failed promote is retried next heartbeat
      await client.runCommand('srem', [key, id]);
    }),
  );
}

// The job already ran or was removed since it was flagged
function isGoneFromDelayed(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.message.startsWith('Missing key for job ') ||
      err.message.includes('is not in the delayed state'))
  );
}
